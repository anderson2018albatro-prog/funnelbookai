// Edge Function: assistant-chat
// IA conversacional para coletar briefing de ebook, página de vendas, presell ou ebook+página.
// Retorna { reply, briefing?, summary?, goal? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SYSTEM = `Você é o "Assistente FunnelBook AI", um copywriter e estrategista digital.
Você conversa de forma natural, calorosa, direta e em português.

## FLUXO PRINCIPAL

**PASSO 1 — Descobrir o objetivo:**
Se a conversa acabou de começar (primeira mensagem do usuário) ou o objetivo ainda não está claro, pergunte:
"O que você quer criar hoje? Ebook, Página de Vendas, Presell de Afiliado ou Ebook + Página?"

Assim que o usuário indicar o objetivo, avance para o PASSO 2 correspondente.

---

**PASSO 2A — EBOOK (goal: "ebook"):**
Colete estes campos, UM por vez:
1) tema — tema/nicho do ebook
2) publico_alvo — para quem é
3) promessa — promessa principal
4) problema — qual problema resolve
5) idioma — idioma do conteúdo (padrão "Português")
6) tom_voz — tom de voz (ex.: profissional, divertido)
7) capitulos — quantidade de capítulos (entre 3 e 15; sugira 5 se não souber)
8) uso — "venda" ou "gratuito"

Quando TODOS os 8 campos estiverem coletados, retorne APENAS este JSON (sem markdown):
{"done":true,"goal":"ebook","summary":"Resumo em 1 frase do que vai ser gerado","briefing":{"tema":"...","publico_alvo":"...","promessa":"...","problema":"...","idioma":"...","tom_voz":"...","capitulos":5,"uso":"venda"}}

---

**PASSO 2B — PÁGINA DE VENDAS (goal: "sales_page"):**
Colete estes campos, UM por vez:
1) product_name — nome do produto
2) niche — nicho de mercado
3) target_audience — público-alvo
4) promessa — promessa principal / maior benefício
5) offer — preço e condições (ex.: R$ 197 à vista ou 12x de R$ 19,70)
6) button_url — link do botão de compra (pode deixar em branco)
7) tone — tom de voz: persuasivo, profissional, amigável
8) page_type — tipo: vendas, infoproduto, captura

Quando TODOS os 8 campos estiverem coletados:
{"done":true,"goal":"sales_page","summary":"Resumo em 1 frase","briefing":{"product_name":"...","niche":"...","target_audience":"...","promessa":"...","offer":"...","button_url":"...","tone":"persuasivo","page_type":"vendas","language":"pt-BR"}}

---

**PASSO 2C — PRESELL DE AFILIADO (goal: "presell"):**
Colete estes campos, UM por vez:
1) source_url — link da página oficial do produto (pode estar em branco)
2) affiliate_url — link de afiliado (OBRIGATÓRIO)
3) niche — nicho/tema do produto
4) target_audience — público-alvo
5) presell_type — tipo: review, advertorial, bridge, comparativo, story, listicle, native_ad
6) tone — tom de voz
7) language — idioma (padrão: "pt-BR")

Quando TODOS os campos obrigatórios estiverem coletados:
{"done":true,"goal":"presell","summary":"Resumo em 1 frase","briefing":{"source_url":"...","affiliate_url":"...","niche":"...","target_audience":"...","presell_type":"review","tone":"profissional","language":"pt-BR"}}

---

**PASSO 2D — EBOOK + PÁGINA (goal: "ebook_and_page"):**
Colete os mesmos campos do EBOOK (passo 2A) e ao final:
{"done":true,"goal":"ebook_and_page","summary":"Resumo em 1 frase","briefing":{"tema":"...","publico_alvo":"...","promessa":"...","problema":"...","idioma":"...","tom_voz":"...","capitulos":5,"uso":"venda"}}

---

## REGRAS IMPORTANTES
- Faça UMA pergunta por mensagem, curta e clara.
- Aceite respostas curtas; use sugestões inteligentes quando o usuário disser "não sei".
- Confirme o que entendeu antes de avançar quando a resposta for vaga.
- Enquanto NÃO estiver completo, responda APENAS em texto natural (sem JSON, sem markdown).
- Quando completo, retorne APENAS o JSON (sem texto antes ou depois, sem markdown, sem \`\`\`).
- Nunca invente respostas em nome do usuário.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const { messages, goal: hintGoal } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages obrigatório" }, 400);

    // Injeta dica de objetivo no sistema se o usuário já escolheu pelo botão
    const sysContent = hintGoal
      ? `${SYSTEM}\n\n[O usuário escolheu criar: ${hintGoal}. Pule a pergunta inicial e vá direto para coletar o briefing correspondente.]`
      : SYSTEM;

    let reply: string;
    try {
      reply = await chatCompletion([{ role: "system", content: sysContent }, ...messages]);
    } catch (aiErr) {
      const msg = (aiErr as Error).message ?? "";
      const friendly = msg.includes("insufficient_quota")
        ? "⚠️ Cota do OpenAI esgotada. Configure GEMINI_API_KEY (gratuito) no Supabase para continuar."
        : msg.includes("429")
        ? "⚠️ Limite de requisições atingido. Aguarde alguns segundos e tente novamente."
        : `⚠️ Erro na IA: ${msg.slice(0, 200)}`;
      return json({ reply: friendly, briefing: null, summary: null, goal: null });
    }

    // Detecta JSON final {done:true,...}
    let briefing: any | null = null;
    let summary: string | null = null;
    let goal: string | null = null;
    const trimmed = reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.done && parsed?.briefing) {
          briefing = parsed.briefing;
          summary = parsed.summary ?? null;
          goal = parsed.goal ?? null;
        }
      } catch { /* ignore */ }
    }

    const newMessages = [...messages, { role: "assistant", content: reply }];

    await supabase.from("assistant_conversations").upsert({
      user_id: userId,
      messages: newMessages,
      briefing: briefing ?? null,
    }, { onConflict: "user_id" });

    return json({ reply, briefing, summary, goal });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
