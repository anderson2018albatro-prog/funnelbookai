// Edge Function: generate-ebook
// Cria o registro do ebook em "processing", debita 1 crédito,
// e processa a geração em background (EdgeRuntime.waitUntil) para não estourar timeout.
// O frontend faz polling em ebooks.status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";
import { jsonrepair } from "https://esm.sh/jsonrepair@3.6.1";

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
  // Trim to outermost { ... } if there's extra prose before or after
  const first = c.indexOf("{");
  const last = c.lastIndexOf("}");
  if (first >= 0 && last > first) c = c.slice(first, last + 1);
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
  try { return JSON.parse(cleaned); } catch (_) { /* continua */ }
  try { return JSON.parse(sanitizeLlmJson(cleaned)); } catch (_) { /* continua */ }
  try { return JSON.parse(jsonrepair(cleaned)); } catch (_) { /* continua */ }
  try { return JSON.parse(jsonrepair(sanitizeLlmJson(cleaned))); } catch (e) {
    const msg = (e as Error).message;
    // mostra a janela ao redor da posição da falha para diagnóstico
    const pos = Number(msg.match(/position (\d+)/)?.[1] ?? -1);
    const ctx = pos >= 0 ? cleaned.slice(Math.max(0, pos - 80), pos + 80) : cleaned.slice(0, 200);
    throw new Error(`JSON inválido da IA após reparos: ${msg}. Contexto: …${ctx}…`);
  }
}

async function callAI(_lovableKey: string, prompt: string) {
  const content = await chatCompletion([
    { role: "system", content: "Você é um escritor profissional de ebooks. REGRA ABSOLUTA: responda APENAS com um objeto JSON válido. Nenhum texto antes, nenhum texto depois, nenhuma cerca de código (```). Dentro de strings JSON use \\n para quebrar linhas, nunca quebre linhas literais dentro de strings." },
    { role: "user", content: prompt },
  ], 8000);
  if (!content) throw new Error("Resposta vazia da IA");
  return parseLoose(content);
}

function mockEbookContent(briefing: any): any {
  const tema = briefing.tema || "Desenvolvimento Pessoal";
  const n = typeof briefing.capitulos === "number" ? Math.min(15, Math.max(3, briefing.capitulos)) : 5;
  const chapters = Array.from({ length: n }, (_, i) => ({
    title: `Capítulo ${i + 1}: ${["Fundamentos Essenciais","Estratégias Avançadas","Implementação Prática","Superando Obstáculos","Resultados e Próximos Passos","Mindset de Crescimento","Ferramentas e Recursos","Cases de Sucesso","Erros Comuns","Aceleração de Resultados","Sustentabilidade","Comunidade e Suporte","Automação","Escalabilidade","Legado"][i] || `Módulo ${i + 1}`}`,
    content: `Este capítulo aborda aspectos fundamentais de ${tema}.\n\nConteúdo completo será gerado pela IA quando você usar o modo real. Este é apenas um conteúdo de demonstração para testar o fluxo sem gastar créditos de IA.\n\nO texto real terá entre 400 e 600 palavras com exemplos práticos, estratégias aplicáveis e referências relevantes para o público de ${briefing.publico_alvo || "este ebook"}.`,
  }));
  return {
    title: `${tema}: O Guia Definitivo`,
    subtitle: `Tudo que você precisa saber para transformar sua vida com ${tema}`,
    introduction: `Bem-vindo ao guia definitivo sobre ${tema}. Este ebook foi criado especialmente para ${briefing.publico_alvo || "você"}.\n\nNeste material você vai encontrar estratégias práticas, exemplos reais e um passo a passo completo para alcançar ${briefing.promessa || "seus objetivos"}.\n\n[MODO MOCK — conteúdo real gerado pela IA no modo normal]`,
    summary: chapters.map((c) => c.title),
    chapters,
    conclusion: `Chegamos ao final desta jornada sobre ${tema}. Você agora tem todas as ferramentas necessárias para dar o próximo passo e transformar sua realidade.\n\n[MODO MOCK — conteúdo real gerado pela IA no modo normal]`,
    call_to_action: `Não deixe para depois! Comece hoje mesmo a aplicar o que aprendeu. Seu sucesso começa com uma ação.`,
    bonus: ["Checklist de implementação rápida", "Planilha de acompanhamento de resultados", "Acesso à comunidade exclusiva"],
  };
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
    // 4 capítulos máx para o budget de tokens (8000 tokens de saída ≈ 75s no gpt-4o-mini)
    const chapters = Math.min(4, Math.max(3, Number(briefing.capitulos) || 4));

    const prompt = `Crie um ebook PROFISSIONAL E COMPLETO no idioma "${briefing.idioma || "Português"}", com tom "${briefing.tom_voz || "profissional e acessível"}".

BRIEFING DO EBOOK:
- Tema/Nicho: ${briefing.tema}
- Público-alvo: ${briefing.publico_alvo}
- Promessa principal: ${briefing.promessa || "transformar a vida do leitor"}
- Problema que resolve: ${briefing.problema || "dificuldades na área"}
- Número de capítulos: EXATAMENTE ${chapters}
- Uso: ${briefing.uso || "venda"}

PADRÃO DE QUALIDADE — cada capítulo deve ter:
• Introdução do tema do capítulo (1 parágrafo)
• 2-3 conceitos principais com explicação detalhada
• Pelo menos 1 exemplo prático real e aplicável
• Dicas concretas e acionáveis para o público "${briefing.publico_alvo}"
• Mini-resumo ou próximo passo ao final
• Entre 400 e 550 palavras por capítulo — NÃO ultrapasse 550 (texto longo demais corta o final do ebook)

REGRAS TÉCNICAS ABSOLUTAS:
1. Retorne APENAS o JSON. Sem texto antes. Sem texto depois. Sem cercas de código.
2. Use \\n\\n para separar parágrafos dentro de strings. NUNCA quebras de linha literais.
3. Escape aspas dentro de strings como \\".
4. O array "chapters" deve ter EXATAMENTE ${chapters} objetos.
5. Preencha TODOS os campos do schema, incluindo "conclusion", "call_to_action" e "bonus" no final. Seja conciso nos capítulos para garantir que o JSON termine completo.

SCHEMA (preencha todos os campos com conteúdo rico e específico):
{
  "title": "Título criativo e atraente do ebook",
  "subtitle": "Subtítulo que complementa e detalha a promessa",
  "introduction": "Introdução motivacional de 2-3 parágrafos separados por \\n\\n explicando o problema, a solução e o que o leitor vai conquistar",
  "summary": ["Título Capítulo 1", "Título Capítulo 2"],
  "chapters": [
    {
      "title": "Título específico do capítulo",
      "content": "Conteúdo rico de 400-550 palavras com conceitos, exemplos e dicas. Parágrafos separados por \\n\\n."
    }
  ],
  "conclusion": "Conclusão inspiradora de 2 parágrafos que recapitula os principais aprendizados e incentiva a ação",
  "call_to_action": "Chamada para ação clara e motivadora",
  "bonus": ["Bônus prático 1", "Bônus prático 2", "Bônus prático 3"]
}`;

    console.log("[generate-ebook] iniciando IA", ebookId, `${chapters} capítulos`);
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
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);
    if (!lovableKey && !geminiKey && !openaiKey) {
      return json({ error: "Configure GEMINI_API_KEY (gratuito), LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const testMode = body.test_mode === true;
    const paginas = Math.min(Math.max(Number(body.paginas) || Number(body.capitulos) * 4 || 25, 8), 50);
    const capitulos = Number(body.capitulos) || 5;
    const briefing = {
      tema: body.tema || (testMode ? "Marketing Digital para Iniciantes" : undefined),
      publico_alvo: body.publico_alvo || (testMode ? "Empreendedores iniciantes" : undefined),
      promessa: body.promessa ?? "",
      problema: body.problema ?? "",
      idioma: body.idioma ?? "Português",
      tom_voz: body.tom_voz ?? "Profissional e acessível",
      paginas,
      capitulos,
      uso: body.uso ?? "venda",
    };
    if (!briefing.tema || !briefing.publico_alvo) {
      return json({ error: "tema e publico_alvo são obrigatórios" }, 400);
    }

    if (testMode) {
      // Mock: sem IA, sem crédito
      const mockContent = mockEbookContent(briefing);
      const { data: ebook, error: insErr } = await admin.from("ebooks").insert({
        user_id: userId, title: mockContent.title, niche: briefing.tema,
        content: { ...mockContent, briefing }, status: "completed",
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      return json({ ebookId: ebook.id, status: "completed", test_mode: true }, 201);
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
      processInBackground({ admin, lovableKey: lovableKey ?? "", ebookId: ebook.id, userId, briefing })
    );

    return json({ ebookId: ebook.id, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
