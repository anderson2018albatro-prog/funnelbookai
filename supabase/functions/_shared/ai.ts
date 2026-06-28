// Shared AI helper.
// Ordem de tentativa: LOVABLE_API_KEY → GEMINI_API_KEY → OPENAI_API_KEY
// Gemini (Google AI Studio) é gratuito: 1500 req/dia, 1M tokens/min.
// OpenAI faz retry automático em 429 (rate limit), mas não em quota esgotada.

type Msg = { role: "system" | "user" | "assistant"; content: string };

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function callOpenAI(key: string, messages: Msg[], maxTokens: number): Promise<string> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.7, max_tokens: maxTokens, response_format: { type: "json_object" }, messages }),
    });
    if (res.ok) {
      const j = await res.json();
      const c = j.choices?.[0]?.message?.content ?? "";
      if (c) return c;
      throw new Error("OpenAI: resposta vazia");
    }
    const t = await res.text();
    // 429 rate limit: retry com backoff. 429 quota esgotada: falha imediata.
    if (res.status === 429 && !t.includes("insufficient_quota") && attempt < 2) {
      await sleep((attempt + 1) * 4000);
      continue;
    }
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 400)}`);
  }
  throw new Error("OpenAI: limite de tentativas atingido");
}

async function callGemini(key: string, messages: Msg[], maxTokens: number): Promise<string> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        max_tokens: maxTokens,
        // Desliga o "thinking" do Gemini 2.5: para saída estruturada (JSON) os
        // tokens de raciocínio só consomem o budget e truncam o JSON no meio.
        reasoning_effort: "none",
        // JSON mode: força saída JSON válida na origem (evita aspas não escapadas).
        response_format: { type: "json_object" },
        messages,
      }),
    }
  );
  if (res.ok) {
    const j = await res.json();
    const c = j.choices?.[0]?.message?.content ?? "";
    if (c) return c;
    throw new Error("Gemini: resposta vazia");
  }
  const t = await res.text();
  throw new Error(`Gemini ${res.status}: ${t.slice(0, 400)}`);
}

async function callLovable(key: string, messages: Msg[], maxTokens: number): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: maxTokens, response_format: { type: "json_object" } }),
  });
  if (res.ok) {
    const j = await res.json();
    const c = j.choices?.[0]?.message?.content ?? "";
    if (c) return c;
    throw new Error("Lovable: resposta vazia");
  }
  const t = await res.text();
  throw new Error(`Lovable ${res.status}: ${t.slice(0, 300)}`);
}

export async function chatCompletion(messages: Msg[], maxTokens = 4096): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const geminiKey  = Deno.env.get("GEMINI_API_KEY");
  const openaiKey  = Deno.env.get("OPENAI_API_KEY");

  const errs: string[] = [];

  if (lovableKey) {
    try { return await callLovable(lovableKey, messages, maxTokens); }
    catch (e) { errs.push(`Lovable: ${(e as Error).message}`); }
  }

  if (geminiKey) {
    try { return await callGemini(geminiKey, messages, maxTokens); }
    catch (e) { errs.push(`Gemini: ${(e as Error).message}`); }
  }

  if (openaiKey) {
    try { return await callOpenAI(openaiKey, messages, maxTokens); }
    catch (e) { errs.push(`OpenAI: ${(e as Error).message}`); }
  }

  if (!lovableKey && !geminiKey && !openaiKey) {
    throw new Error("Nenhuma chave de IA configurada. Configure GEMINI_API_KEY (gratuito) ou OPENAI_API_KEY.");
  }
  throw new Error(`Falha em todos os provedores:\n${errs.join("\n")}`);
}
