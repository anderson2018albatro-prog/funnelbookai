// Edge Function: generate-sales-page
// Gera página de vendas baseada no ebook do projeto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slugify(input: string) {
  return (
    input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "pagina"
  );
}

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

    const { projectId } = await req.json();
    if (!projectId) return json({ error: "projectId obrigatório" }, 400);

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (pErr || !project) return json({ error: "Projeto não encontrado" }, 404);

    const { data: ebook } = await supabase
      .from("ebooks")
      .select("titulo, subtitulo, conteudo")
      .eq("project_id", projectId)
      .maybeSingle();

    const ctx = ebook
      ? `Ebook: ${ebook.titulo}\nSubtítulo: ${ebook.subtitulo ?? ""}`
      : "Sem ebook ainda.";

    const prompt = `Você é um copywriter especialista em alta conversão. Crie uma página de vendas em ${project.idioma} para:

${ctx}
Nicho: ${project.nicho}
Público-alvo: ${project.publico_alvo}
Promessa: ${project.promessa}

Retorne APENAS JSON válido:
{
  "headline": string,
  "subheadline": string,
  "problema": string,
  "solucao": string,
  "beneficios": string[],   // 5-8 itens
  "aprendizados": string[], // 4-8 itens
  "faq": [{ "pergunta": string, "resposta": string }], // 4-6
  "garantia": string,
  "cta_text": string
}`;

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

    let sp: any;
    try {
      sp = JSON.parse(content);
    } catch {
      return json({ error: "JSON inválido da OpenAI" }, 500);
    }

    // slug único
    const base = slugify(project.nome_projeto);
    let slug = base;
    let suffix = 0;
    while (true) {
      const { data: ex } = await supabase
        .from("sales_pages")
        .select("id, project_id")
        .eq("slug", slug)
        .maybeSingle();
      if (!ex || ex.project_id === projectId) break;
      suffix++;
      slug = `${base}-${suffix}`;
    }

    const payload = {
      project_id: projectId,
      slug,
      headline: sp.headline,
      subheadline: sp.subheadline,
      beneficios: sp.beneficios ?? [],
      aprendizados: sp.aprendizados ?? [],
      faq: sp.faq ?? [],
      garantia: sp.garantia ?? "",
      cta_text: sp.cta_text ?? "Quero Agora",
      public_url: `/p/${slug}`,
      // armazenamos problema/solução dentro do html_content como JSON extra leve
      html_content: JSON.stringify({
        problema: sp.problema ?? "",
        solucao: sp.solucao ?? "",
      }),
    };

    const { data: existing } = await supabase
      .from("sales_pages")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

    let saved;
    if (existing) {
      const { data, error } = await supabase
        .from("sales_pages")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("sales_pages")
        .insert(payload)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      saved = data;
    }

    return json({ salesPage: saved });
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
