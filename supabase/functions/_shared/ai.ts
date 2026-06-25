// Shared AI helper. Tries Lovable AI Gateway first, falls back to OpenAI on
// 402 (out of credits) / 429 (rate limited) / 5xx. Returns the assistant message string.

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function chatCompletion(messages: Msg[]): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  let lastErr: string | null = null;

  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
      });
      if (res.ok) {
        const j = await res.json();
        const c = j.choices?.[0]?.message?.content ?? "";
        if (c) return c;
        lastErr = "Lovable: resposta vazia";
      } else {
        const t = await res.text();
        lastErr = `Lovable ${res.status}: ${t.slice(0, 300)}`;
        // Only fallback on credit / rate / upstream errors
        if (![402, 429, 500, 502, 503, 504].includes(res.status)) throw new Error(lastErr);
      }
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }

  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.7, messages }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}${lastErr ? ` | antes: ${lastErr}` : ""}`);
    }
    const j = await res.json();
    const c = j.choices?.[0]?.message?.content ?? "";
    if (!c) throw new Error("OpenAI: resposta vazia");
    return c;
  }

  throw new Error(lastErr || "Nenhuma chave de IA configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)");
}
