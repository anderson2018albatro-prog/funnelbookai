// Edge Function: generate-ebook
// Cria o registro do ebook em "processing", debita 1 crédito,
// e processa a geração em background (EdgeRuntime.waitUntil) para não estourar timeout.
// O frontend faz polling em ebooks.status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) {
    c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return c;
}

async function callAI(lovableKey: string, prompt: string) {
  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você responde APENAS com JSON válido, sem markdown e sem cercas de código." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!aiRes.ok) {
    const t = await aiRes.text();
    throw new Error(`IA ${aiRes.status}: ${t.slice(0, 400)}`);
  }
  const ai = await aiRes.json();
  const content = ai.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Resposta vazia da IA");
  return JSON.parse(stripFences(content));
}

async function processInBackground(opts: {
  admin: ReturnType<typeof createClient>;
  lovableKey: string;
  ebookId: string;
  userId: string;
  briefing: any;
}) {
  const { admin, lovableKey, ebookId, userId, briefing } = opts;
  try {
    const prompt = `Você é um escritor profissional de ebooks. Crie um ebook COMPLETO no idioma "${briefing.idioma}", com tom "${briefing.tom_voz}".

Briefing:
- Tema/Nicho: ${briefing.tema}
- Público-alvo: ${briefing.publico_alvo}
- Promessa principal: ${briefing.promessa ?? ""}
- Problema que resolve: ${briefing.problema ?? ""}
- Quantidade de capítulos: ${briefing.capitulos}
- Uso (venda ou material gratuito): ${briefing.uso ?? "venda"}

Retorne APENAS JSON válido no schema:
{
  "title": string,
  "subtitle": string,
  "introduction": string,
  "summary": string[],
  "chapters": [{ "title": string, "content": string }],
  "conclusion": string,
  "call_to_action": string,
  "bonus": string[]
}
Regras:
- Cada capítulo: 500–900 palavras, em texto corrido com parágrafos separados por \\n\\n.
- summary: lista com o título de cada capítulo, na ordem.
- bonus: 2 a 4 ideias acionáveis.
- introduction: 2–4 parágrafos.
- call_to_action: 1 parágrafo persuasivo.`;

    console.log("[generate-ebook] iniciando IA", ebookId);
    const ebookData = await callAI(lovableKey, prompt);

    const { error: updErr } = await admin
      .from("ebooks")
      .update({
        title: ebookData.title ?? "Ebook sem título",
        content: { ...ebookData, briefing },
        status: "completed",
        error_message: null,
      })
      .eq("id", ebookId);
    if (updErr) throw new Error(updErr.message);
    console.log("[generate-ebook] concluído", ebookId);
  } catch (e) {
    const msg = (e as Error).message ?? "Falha desconhecida";
    console.error("[generate-ebook] falhou", ebookId, msg);
    await admin
      .from("ebooks")
      .update({ status: "failed", error_message: msg })
      .eq("id", ebookId);
    // devolve o crédito
    const { data: cr } = await admin
      .from("user_credits").select("credits").eq("user_id", userId).maybeSingle();
    if (cr) {
      await admin.from("user_credits")
        .update({ credits: (cr.credits ?? 0) + 1 }).eq("user_id", userId);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const briefing = {
      tema: body.tema,
      publico_alvo: body.publico_alvo,
      promessa: body.promessa ?? "",
      problema: body.problema ?? "",
      idioma: body.idioma ?? "Português",
      tom_voz: body.tom_voz ?? "Profissional e acessível",
      capitulos: Math.min(Math.max(Number(body.capitulos) || 8, 3), 15),
      uso: body.uso ?? "venda",
    };
    if (!briefing.tema || !briefing.publico_alvo) {
      return json({ error: "tema e publico_alvo são obrigatórios" }, 400);
    }

    // Checa créditos
    const { data: creditsRow } = await admin
      .from("user_credits").select("credits").eq("user_id", userId).maybeSingle();
    if (!creditsRow || (creditsRow.credits ?? 0) <= 0) {
      return json({ error: "Créditos insuficientes" }, 402);
    }

    // Debita 1 crédito imediatamente (refund se falhar)
    await admin.from("user_credits")
      .update({ credits: creditsRow.credits - 1 }).eq("user_id", userId);

    // Cria placeholder
    const placeholderTitle = (briefing.tema as string).slice(0, 80) || "Novo ebook";
    const { data: ebook, error: insErr } = await admin
      .from("ebooks")
      .insert({
        user_id: userId,
        title: placeholderTitle,
        niche: briefing.tema,
        content: { briefing },
        status: "processing",
      })
      .select("id")
      .single();
    if (insErr) {
      // refund
      await admin.from("user_credits")
        .update({ credits: creditsRow.credits }).eq("user_id", userId);
      return json({ error: insErr.message }, 500);
    }

    // Dispara processamento em background
    // @ts-ignore EdgeRuntime existe em Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processInBackground({ admin, lovableKey, ebookId: ebook.id, userId, briefing })
    );

    return json({ ebookId: ebook.id, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
