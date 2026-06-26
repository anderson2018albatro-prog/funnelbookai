// Edge Function: assistant-chat
// Conversa com o usuário para montar o briefing do ebook.
// Recebe: { messages: [{role,content}] }
// Retorna: { reply: string, briefing?: object }
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
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM = `Você é o "Assistente FunnelBook AI", um copywriter e estrategista que ajuda o usuário a montar o briefing de um ebook em português, conversando de forma natural, calorosa e direta.

Sua MISSÃO é coletar OBRIGATORIAMENTE estas informações, uma por vez (não pergunte tudo de uma vez):
1) tema — o tema/nicho do ebook
2) publico_alvo — para quem é
3) promessa — a promessa principal
4) problema — qual problema o ebook resolve
5) idioma — idioma do conteúdo (padrão "Português")
6) tom_voz — tom de voz (ex.: profissional, divertido, técnico)
7) capitulos — quantidade de capítulos (entre 8 e 15; sugira se não souber)
8) uso — "venda" ou "gratuito"

REGRAS:
- Faça UMA pergunta por mensagem, curta e clara. Confirme o que entendeu antes de avançar quando o usuário for vago.
- Aceite respostas curtas. Use sugestões inteligentes quando o usuário disser "não sei".
- Quando TODAS as 8 informações estiverem coletadas, retorne UMA mensagem final em JSON puro (sem markdown) no formato:
{"done": true, "summary": "Resumo curto do briefing", "briefing": {"tema":"...","publico_alvo":"...","promessa":"...","problema":"...","idioma":"...","tom_voz":"...","capitulos": 10, "uso":"venda"}}
- Enquanto NÃO estiver completo, responda APENAS em texto natural (sem JSON, sem markdown), com a próxima pergunta ou confirmação.
- Nunca invente respostas em nome do usuário. Se faltar alguma informação, pergunte.`;

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

    const { messages } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages obrigatório" }, 400);

    const reply = await chatCompletion([{ role: "system", content: SYSTEM }, ...messages]);

    // tenta detectar JSON final {done:true,...}
    let briefing: any | null = null;
    let summary: string | null = null;
    const trimmed = reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.done && parsed?.briefing) {
          briefing = parsed.briefing;
          summary = parsed.summary ?? null;
        }
      } catch { /* ignore */ }
    }

    const newMessages = [...messages, { role: "assistant", content: reply }];

    // upsert conversa
    await supabase.from("assistant_conversations").upsert({
      user_id: userId,
      messages: newMessages,
      briefing: briefing ?? null,
    }, { onConflict: "user_id" });

    return json({ reply, briefing, summary });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
