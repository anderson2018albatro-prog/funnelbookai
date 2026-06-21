// Edge Function: improve-copy
// Reescreve um texto da página de vendas conforme instrução do usuário.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const { instruction, content, mode } = await req.json();
    if (!instruction) return json({ error: "instruction obrigatório" }, 400);

    const m = mode || "text";
    const sys = m === "list"
      ? `Você é copywriter de alta conversão. Reescreva a LISTA fornecida conforme a instrução do usuário. Retorne APENAS JSON puro: { "items": string[] }.`
      : m === "faq"
      ? `Você é copywriter. Reescreva o FAQ conforme a instrução. Retorne APENAS JSON puro: { "items": [{"pergunta": string, "resposta": string}] }.`
      : `Você é copywriter de alta conversão em português. Reescreva o TEXTO conforme a instrução. Retorne APENAS o novo texto, sem markdown, sem aspas externas.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Instrução: ${instruction}\n\nConteúdo atual:\n${typeof content === "string" ? content : JSON.stringify(content)}` },
        ],
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Limite atingido. Tente novamente." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: `IA ${aiRes.status}: ${t.slice(0, 300)}` }, 500);
    }
    const ai = await aiRes.json();
    let out: string = ai.choices?.[0]?.message?.content ?? "";
    out = out.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    if (m === "list" || m === "faq") {
      try {
        const parsed = JSON.parse(out);
        return json({ result: parsed.items ?? parsed });
      } catch {
        return json({ error: "IA não retornou JSON válido" }, 500);
      }
    }
    return json({ result: out });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
