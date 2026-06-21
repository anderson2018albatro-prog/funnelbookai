// Edge Function: generate-ebook
// Gera um ebook completo via Lovable AI (Gemini) e salva na tabela ebooks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const {
      tema,
      publico_alvo,
      idioma = "Português",
      tom_voz = "Profissional e acessível",
      capitulos = 6,
    } = body ?? {};
    if (!tema || !publico_alvo) {
      return json({ error: "tema e publico_alvo são obrigatórios" }, 400);
    }

    // Verifica créditos
    const { data: creditsRow } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", userId)
      .maybeSingle();
    if (!creditsRow || creditsRow.credits <= 0) {
      return json({ error: "Créditos insuficientes" }, 402);
    }

    const prompt = `Você é um escritor profissional de ebooks. Crie um ebook COMPLETO no idioma "${idioma}", com tom "${tom_voz}".

Tema/Nicho: ${tema}
Público-alvo: ${publico_alvo}
Quantidade de capítulos: ${capitulos}

Retorne APENAS JSON válido no schema:
{
  "title": string,
  "subtitle": string,
  "description": string,
  "summary": string[],
  "chapters": [{ "title": string, "content": string }],
  "conclusion": string,
  "bonus": string
}
Cada capítulo deve ter de 500 a 900 palavras em texto corrido, parágrafos separados por \\n\\n. O bônus deve ser uma seção extra acionável.`;

    console.log("[generate-ebook] chamando Lovable AI", { tema, capitulos });
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
      console.error("[generate-ebook] IA erro", aiRes.status, t);
      if (aiRes.status === 429) return json({ error: "Limite de uso atingido, tente novamente em alguns minutos." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados na workspace." }, 402);
      return json({ error: `IA ${aiRes.status}: ${t.slice(0, 300)}` }, 500);
    }
    const ai = await aiRes.json();
    let content: string = ai.choices?.[0]?.message?.content ?? "";
    if (!content) {
      console.error("[generate-ebook] resposta vazia", ai);
      return json({ error: "Resposta vazia da IA" }, 500);
    }

    // remove markdown fences se houver
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }

    let ebookData: any;
    try {
      ebookData = JSON.parse(content);
    } catch (e) {
      console.error("[generate-ebook] JSON parse falhou. Conteúdo:", content.slice(0, 500));
      return json({ error: "JSON inválido da IA" }, 500);
    }

    const { data: saved, error: insErr } = await supabase
      .from("ebooks")
      .insert({
        user_id: userId,
        title: ebookData.title ?? "Ebook sem título",
        niche: tema,
        content: { ...ebookData, publico_alvo, idioma, tom_voz },
      })
      .select()
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    // Debita 1 crédito (service role para bypass do RLS update — não temos política de update)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("user_credits")
        .update({ credits: creditsRow.credits - 1 })
        .eq("user_id", userId);
    }

    return json({ ebook: saved });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
