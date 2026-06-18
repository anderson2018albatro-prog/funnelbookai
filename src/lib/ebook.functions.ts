import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const GenerateInput = z.object({ projectId: z.string().uuid() });

export const generateEbook = createServerFn({ method: "POST" })
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

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `Você é um escritor profissional de ebooks. Crie um ebook completo no idioma "${project.idioma}".

Dados do projeto:
- Nome: ${project.nome_projeto}
- Nicho: ${project.nicho}
- Público-alvo: ${project.publico_alvo}
- Promessa principal: ${project.promessa}
- Quantidade de capítulos: ${project.quantidade_capitulos}

Gere um ebook profissional, persuasivo, em ${project.idioma}, com linguagem clara e exemplos práticos. Cada capítulo deve ter entre 400 e 700 palavras em texto corrido (use parágrafos com quebras \\n\\n, sem markdown excessivo).`;

    const { experimental_output } = await generateText({
      model,
      prompt,
      experimental_output: Output.object({
        schema: z.object({
          titulo: z.string(),
          subtitulo: z.string(),
          introducao: z.string(),
          sumario: z.array(z.string()),
          capitulos: z.array(z.object({
            titulo: z.string(),
            conteudo: z.string(),
          })),
          conclusao: z.string(),
        }),
      }),
    });

    const ebookData = experimental_output;

    // Upsert ebook for project
    const { data: existing } = await supabase
      .from("ebooks")
      .select("id")
      .eq("project_id", data.projectId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("ebooks")
        .update({
          titulo: ebookData.titulo,
          subtitulo: ebookData.subtitulo,
          conteudo: ebookData as any,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }
    const { data: inserted, error } = await supabase
      .from("ebooks")
      .insert({
        project_id: data.projectId,
        titulo: ebookData.titulo,
        subtitulo: ebookData.subtitulo,
        conteudo: ebookData as any,
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });
