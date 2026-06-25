// Edge Function: generate-ebook
// Cria o registro do ebook em "processing", debita 1 crédito,
// e processa a geração em background (EdgeRuntime.waitUntil) para não estourar timeout.
// O frontend faz polling em ebooks.status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";

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
  // Trim to outermost { ... } if there's extra prose
  const first = c.indexOf("{");
  const last = c.lastIndexOf("}");
  if (first > 0 && last > first) c = c.slice(first, last + 1);
  return c;
}

// Sanitiza JSON vindo de LLMs: escapa caracteres de controle crus
// dentro de strings e neutraliza barras invertidas inválidas.
// Causa raiz do erro "Bad escaped character in JSON at position X".
function sanitizeLlmJson(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) {
      // já validado abaixo; copia
      out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      if (inStr) {
        const next = s[i + 1] ?? "";
        if (!'"\\/bfnrtu'.includes(next)) {
          // escape inválido -> escapa a própria barra
          out += "\\\\";
          continue;
        }
      }
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (inStr) {
      const code = ch.charCodeAt(0);
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      if (code < 0x20) {
        out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function parseLoose(raw: string): any {
  const cleaned = stripFences(raw);
  try { return JSON.parse(cleaned); } catch (_) { /* fallthrough */ }
  try { return JSON.parse(sanitizeLlmJson(cleaned)); } catch (e) {
    throw new Error(`JSON inválido da IA: ${(e as Error).message}. Prévia: ${cleaned.slice(0, 200)}`);
  }
}

async function callAI(_lovableKey: string, prompt: string) {
  const content = await chatCompletion([
    { role: "system", content: "Você responde APENAS com um único objeto JSON válido. Não use markdown nem cercas de código. Dentro das strings, use \\n para quebras de linha — nunca quebras de linha cruas." },
    { role: "user", content: prompt },
  ]);
  if (!content) throw new Error("Resposta vazia da IA");
  return parseLoose(content);
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
    const pages: number = briefing.paginas;
    // ~280 palavras por página A5/A4 de ebook
    const totalWords = pages * 280;
    const chapters = Math.min(14, Math.max(4, Math.round(pages / 4)));
    const wordsPerChapter = Math.max(400, Math.round(totalWords / chapters));
    const minWords = Math.round(wordsPerChapter * 0.85);
    const maxWords = Math.round(wordsPerChapter * 1.15);

    const prompt = `Você é um escritor profissional de ebooks. Crie um ebook COMPLETO no idioma "${briefing.idioma}", com tom "${briefing.tom_voz}".

Briefing:
- Tema/Nicho: ${briefing.tema}
- Público-alvo: ${briefing.publico_alvo}
- Promessa principal: ${briefing.promessa ?? ""}
- Problema que resolve: ${briefing.problema ?? ""}
- Tamanho alvo: ~${pages} páginas (aprox. ${totalWords} palavras no total)
- Quantidade de capítulos: EXATAMENTE ${chapters}
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
Regras OBRIGATÓRIAS:
- Gere EXATAMENTE ${chapters} capítulos. Nem mais, nem menos.
- Cada capítulo deve ter entre ${minWords} e ${maxWords} palavras (alvo ${wordsPerChapter}). Use parágrafos separados por \\n\\n e subtítulos em negrito quando fizer sentido.
- summary: lista com o título de cada capítulo, na ordem.
- bonus: 2 a 4 ideias acionáveis.
- introduction: 2–4 parágrafos densos.
- conclusion: 2–3 parágrafos amarrando a transformação prometida.
- call_to_action: 1 parágrafo persuasivo.
- Dentro das strings JSON, use \\n para quebras de linha. Não retorne quebras de linha cruas.`;

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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);
    if (!lovableKey && !openaiKey) return json({ error: "Configure LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const paginas = Math.min(Math.max(Number(body.paginas) || Number(body.capitulos) * 4 || 25, 8), 50);
    const briefing = {
      tema: body.tema,
      publico_alvo: body.publico_alvo,
      promessa: body.promessa ?? "",
      problema: body.problema ?? "",
      idioma: body.idioma ?? "Português",
      tom_voz: body.tom_voz ?? "Profissional e acessível",
      paginas,
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
