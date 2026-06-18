// Edge Function: generate-ebook
// Generates ebook content via OpenAI and saves it for the authenticated user.
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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "OPENAI_API_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { projectId } = body ?? {};
    if (!projectId) return json({ error: "projectId obrigatório" }, 400);

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (pErr || !project) return json({ error: "Projeto não encontrado" }, 404);

    const prompt = `Você é um escritor profissional de ebooks. Crie um ebook completo no idioma "${project.idioma}".

Dados:
- Nome: ${project.nome_projeto}
- Nicho: ${project.nicho}
- Público-alvo: ${project.publico_alvo}
- Promessa: ${project.promessa}
- Quantidade de capítulos: ${project.quantidade_capitulos}

Retorne APENAS JSON válido no schema:
{
  "titulo": string,
  "subtitulo": string,
  "introducao": string,
  "sumario": string[],
  "capitulos": [{ "titulo": string, "conteudo": string }],
  "conclusao": string,
  "cta_final": string
}
Cada capítulo deve ter de 400 a 700 palavras em texto corrido, parágrafos separados por \\n\\n.`;

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Você responde APENAS com JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!oaiRes.ok) {
      const t = await oaiRes.text();
      return json({ error: `OpenAI: ${oaiRes.status} ${t}` }, 500);
    }
    const oai = await oaiRes.json();
    const content = oai.choices?.[0]?.message?.content;
    if (!content) return json({ error: "Resposta vazia da OpenAI" }, 500);

    let ebookData: any;
    try {
      ebookData = JSON.parse(content);
    } catch {
      return json({ error: "JSON inválido da OpenAI" }, 500);
    }

    const { data: existing } = await supabase
      .from("ebooks")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

    let saved;
    if (existing) {
      const { data, error } = await supabase
        .from("ebooks")
        .update({
          titulo: ebookData.titulo,
          subtitulo: ebookData.subtitulo,
          conteudo: ebookData,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("ebooks")
        .insert({
          project_id: projectId,
          titulo: ebookData.titulo,
          subtitulo: ebookData.subtitulo ?? "",
          conteudo: ebookData,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      saved = data;
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
