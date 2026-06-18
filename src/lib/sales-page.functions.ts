import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { slugify } from "./slug";

const GenerateInput = z.object({ projectId: z.string().uuid() });

export const generateSalesPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .single();
    if (pErr || !project) throw new Error("Projeto não encontrado");

    const { data: ebook } = await supabase
      .from("ebooks")
      .select("titulo, subtitulo, conteudo")
      .eq("project_id", data.projectId)
      .maybeSingle();

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const ebookContext = ebook
      ? `Título do ebook: ${ebook.titulo}\nSubtítulo: ${ebook.subtitulo ?? ""}`
      : "Sem ebook ainda.";

    const prompt = `Você é um copywriter especialista em páginas de vendas de alta conversão. Crie uma página de vendas em ${project.idioma} para o seguinte produto:

${ebookContext}
Nicho: ${project.nicho}
Público-alvo: ${project.publico_alvo}
Promessa: ${project.promessa}

Gere copy persuasivo, emocional e direto. Headlines curtas e impactantes.`;

    const { experimental_output } = await generateText({
      model,
      prompt,
      experimental_output: Output.object({
        schema: z.object({
          headline: z.string(),
          subheadline: z.string(),
          beneficios: z.array(z.string()).min(4).max(8),
          aprendizados: z.array(z.string()).min(4).max(8),
          faq: z.array(z.object({ pergunta: z.string(), resposta: z.string() })).min(3).max(6),
          garantia: z.string(),
          cta_text: z.string(),
        }),
      }),
    });

    const sp = experimental_output;

    // unique slug
    let baseSlug = slugify(project.nome_projeto);
    let slug = baseSlug;
    let suffix = 0;
    while (true) {
      const { data: ex } = await supabase
        .from("sales_pages")
        .select("id, project_id")
        .eq("slug", slug)
        .maybeSingle();
      if (!ex || ex.project_id === data.projectId) break;
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }

    const { data: existing } = await supabase
      .from("sales_pages")
      .select("id")
      .eq("project_id", data.projectId)
      .maybeSingle();

    const payload = {
      project_id: data.projectId,
      slug,
      headline: sp.headline,
      subheadline: sp.subheadline,
      beneficios: sp.beneficios as any,
      aprendizados: sp.aprendizados as any,
      faq: sp.faq as any,
      garantia: sp.garantia,
      cta_text: sp.cta_text,
      public_url: `/p/${slug}`,
    };

    if (existing) {
      const { data: updated, error } = await supabase
        .from("sales_pages")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }
    const { data: inserted, error } = await supabase
      .from("sales_pages")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });
