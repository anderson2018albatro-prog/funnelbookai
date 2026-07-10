// Edge Function: generate-sales-page
// Gera a página de vendas COMPLETA a partir de um ebook — zero input manual:
// todo o contexto (nicho, público, promessa, capítulos) vem do próprio ebook.
// A IA escolhe a MELHOR estrutura (vsl, carta, lançamento, low/high ticket,
// assinatura) e escreve a copy inteira. Usa o mesmo sistema de blocos
// compartilhado (_shared/sales-blocks.ts) do fluxo "Criar com IA".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";
import { jsonrepair } from "https://esm.sh/jsonrepair@3.6.1";
import { buildBlocksFromAI, renderBlocksToHtml } from "../_shared/sales-blocks.ts";

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

function slugify(input: string) {
  return (
    input
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9\s-]/g, "")
      .trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "pagina"
  );
}

function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const first = c.indexOf("{"); const last = c.lastIndexOf("}");
  if (first >= 0 && last > first) c = c.slice(first, last + 1);
  return c;
}

function repairControlChars(s: string): string {
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  let inStr = false, escaped = false, out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { out += c; escaped = false; continue; }
    if (c === "\\") { out += c; escaped = true; continue; }
    if (c === '"') { out += c; inStr = !inStr; continue; }
    if (inStr && c === "\n") { out += "\\n"; continue; }
    if (inStr && c === "\r") { out += "\\r"; continue; }
    if (inStr && c === "\t") { out += "\\t"; continue; }
    out += c;
  }
  return out;
}

function parseLoose(raw: string): any {
  const cleaned = repairControlChars(stripFences(raw));
  try { return JSON.parse(cleaned); } catch { /* continua */ }
  return JSON.parse(jsonrepair(cleaned));
}

const SYSTEM =
  "Você é um copywriter brasileiro especialista em resposta direta (direct response) e páginas de vendas de alta conversão para o mercado digital brasileiro (Hotmart, Kiwify, Eduzz). Responda APENAS com JSON válido, sem markdown, sem cercas de código (```), sem texto fora do JSON. Dentro de strings use \\n para quebras de linha.";

function salesPagePrompt(ebook: any): string {
  const ec = (ebook.content ?? {}) as any;
  const chapters: string[] = Array.isArray(ec?.summary) && ec.summary.length
    ? ec.summary
    : (Array.isArray(ec?.chapters) ? ec.chapters.map((c: any) => String(c?.title ?? "")).filter(Boolean) : []);
  const idioma = ec?.briefing?.idioma || "Português brasileiro";

  return `Crie uma página de vendas COMPLETA em ${idioma} para o ebook abaixo.
Você é o único responsável pela página INTEIRA: estrutura, hierarquia de seções
e toda a copy. PROIBIDO deixar campo vazio, genérico ou com placeholder tipo
"[insira aqui]" — se faltar informação, DEDUZA do contexto com bom senso.

CONTEXTO DO EBOOK:
- Título: ${ebook.title}
- Subtítulo: ${ec?.subtitle ?? ""}
- Introdução: ${String(ec?.introduction ?? "").slice(0, 600)}
- Nicho: ${ebook.niche ?? ""}
- Público-alvo: ${ec?.briefing?.publico_alvo ?? ""}
- Promessa: ${ec?.briefing?.promessa ?? ""}
- Problema que resolve: ${ec?.briefing?.problema ?? ""}
- Capítulos: ${chapters.join(" | ")}

PASSO 1 — ESCOLHA A ESTRUTURA no campo "estrutura" (a melhor para um ebook,
normalmente "carta" ou "low_ticket"): vsl | carta | lancamento | low_ticket |
high_ticket | assinatura.

PASSO 2 — COPY BRASILEIRA DE RESPOSTA DIRETA (todos os campos obrigatórios):
- headline: big idea + benefício + curiosidade (mínimo 8 palavras, específica)
- subheadline: aprofunda a promessa (mínimo 12 palavras)
- dor_titulo: título curto da seção de dor
- dor_lead: 2-3 parágrafos separados por \\n\\n que agitam a dor real do público do ebook
- mecanismo: NOMEIE o método do ebook (nome próprio memorável) + descrição de por que funciona quando tudo falhou
- promessa_principal: a transformação central em 2-3 frases
- beneficios: MÍNIMO 8 bullets de fascínio (curiosidade + benefício específico, ex: "O erro nº 1 que trava seus resultados — e como corrigir em 5 min")
- para_quem: mínimo 5 perfis específicos
- aprendizado: mínimo 6 tópicos concretos EXTRAÍDOS DOS CAPÍTULOS REAIS do ebook
- stack: mínimo 4 itens com valor percebido ancorado (ex: {"item":"Ebook completo com ${chapters.length || 7} capítulos","valor":"R$97"}) + valor_total com a soma ancorada
- price: preço sugerido coerente com a estrutura escolhida (ex: "R$47 à vista")
- ancoragem: 1 frase de ancoragem de preço (ex: "Menos que uma pizza")
- bonus: mínimo 3 bônus com valores
- garantia: incondicional, com prazo
- urgencia: escassez/urgência ÉTICA e real (bônus por tempo limitado, aumento de preço) — NUNCA contadores ou prazos falsos
- faq: mínimo 5 perguntas quebrando objeções reais (tempo, preço, "já tentei antes", acesso, garantia)
- cta: texto de botão urgente e acionável
- oferta: resumo da oferta em 1-2 frases

COPYWRITING ÉTICO (OBRIGATÓRIO): sem promessas falsas ou resultados garantidos,
sem clickbait enganoso, sem urgência inventada. NUNCA escreva depoimentos como
se fossem reais — a seção de prova social da página usa exemplos claramente
marcados como ilustrativos, para o autor substituir pelos reais.

Retorne APENAS o JSON:
{
  "estrutura": "vsl|carta|lancamento|low_ticket|high_ticket|assinatura",
  "headline": string,
  "subheadline": string,
  "dor_titulo": string,
  "dor_lead": string,
  "mecanismo": {"nome": string, "descricao": string},
  "promessa_principal": string,
  "beneficios": string[],
  "para_quem": string[],
  "aprendizado": string[],
  "stack": [{"item": string, "valor": string}],
  "valor_total": string,
  "price": string,
  "ancoragem": string,
  "oferta": string,
  "bonus": string[],
  "garantia": string,
  "urgencia": string,
  "faq": [{"pergunta": string, "resposta": string}],
  "cta": string,
  "video_titulo": string,
  "button_url": "#"
}`;
}

async function processInBackground(opts: {
  admin: ReturnType<typeof createClient>;
  pageId: string;
  ebook: any;
}) {
  const { admin, pageId, ebook } = opts;
  try {
    console.log("[generate-sales-page] chamando IA", pageId);
    const raw = await chatCompletion([
      { role: "system", content: SYSTEM },
      { role: "user", content: salesPagePrompt(ebook) },
    ], 5000);
    if (!raw) throw new Error("Resposta vazia da IA");
    console.log("[generate-sales-page] resposta recebida, parseando", pageId);
    const sp = parseLoose(raw);
    sp.button_url = sp.button_url || "#";
    sp.theme = sp.theme || "clean";
    const title = sp.headline ?? ebook.title;
    const blocks = buildBlocksFromAI(sp, title);
    const html = renderBlocksToHtml(blocks, title);
    console.log("[generate-sales-page] salvando no banco", pageId, "estrutura:", sp.estrutura);
    const { error } = await admin.from("sales_pages").update({
      title, html_content: html, blocks, status: "completed", error_message: null,
    }).eq("id", pageId);
    if (error) throw new Error(error.message);
    console.log("[generate-sales-page] concluído", pageId);
  } catch (e) {
    const msg = (e as Error).message ?? "Falha desconhecida";
    console.error("[generate-sales-page] falhou", pageId, msg);
    const { error: failErr } = await admin.from("sales_pages")
      .update({ status: "failed", error_message: msg })
      .eq("id", pageId);
    if (failErr) console.error("[generate-sales-page] CRÍTICO: não conseguiu marcar failed:", failErr.message);
  }
}

function mockSalesData(ebook: any): any {
  const ec = (ebook.content ?? {}) as any;
  const chapters: string[] = Array.isArray(ec?.summary) ? ec.summary : [];
  return {
    estrutura: "carta",
    headline: `Descubra o Método ${ebook.title}`,
    subheadline: ec?.subtitle ?? "O guia definitivo para transformar sua vida",
    dor_titulo: "Você se identifica com isso?",
    dor_lead: `Você já tentou de tudo e nada funcionou.\n\nA cada nova tentativa, a frustração aumenta.\n\n[MODO MOCK]`,
    mecanismo: { nome: "Método Tripla Alavanca", descricao: "Um processo em 3 fases que ataca a causa raiz. [MODO MOCK]" },
    promessa_principal: ec?.briefing?.promessa ?? "Resultados reais em 30 dias",
    beneficios: chapters.slice(0, 8).length >= 3 ? chapters.slice(0, 8) : ["Benefício 1", "Benefício 2", "Benefício 3"],
    para_quem: ["Iniciantes que querem começar do zero", "Quem busca resultados duradouros", "Quem tem pouco tempo", "Quem já tentou sem sucesso", "Quem quer um passo a passo claro"],
    aprendizado: chapters.slice(0, 6).length ? chapters.slice(0, 6) : ["Tópico 1", "Tópico 2", "Tópico 3"],
    stack: [
      { item: "Ebook completo", valor: "R$97" },
      { item: "Materiais de apoio", valor: "R$47" },
      { item: "Atualizações vitalícias", valor: "R$53" },
      { item: "Checklist de implementação", valor: "R$27" },
    ],
    valor_total: "R$224",
    price: "R$47 à vista",
    ancoragem: "Menos que uma pizza para transformar seus resultados",
    oferta: "Acesso completo por apenas R$47",
    bonus: ["Bônus 1: Guia rápido (valor R$27)", "Bônus 2: Planilha de acompanhamento (valor R$27)"],
    garantia: "30 dias de garantia incondicional",
    urgencia: "Os bônus desta página ficam disponíveis apenas nesta condição de lançamento.",
    faq: [
      { pergunta: "Para quem é?", resposta: ec?.briefing?.publico_alvo ?? "Para qualquer pessoa." },
      { pergunta: "Como acesso?", resposta: "Por e-mail em até 5 minutos após a compra." },
      { pergunta: "Tem garantia?", resposta: "Sim, 30 dias incondicional." },
    ],
    cta: "Garantir meu acesso agora",
    video_titulo: "Assista ao vídeo",
    button_url: "#",
    theme: "clean",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);
    if (!anthropicKey && !lovableKey && !geminiKey && !openaiKey) {
      return json({ error: "Configure ANTHROPIC_API_KEY, GEMINI_API_KEY (gratuito), LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body2 = await req.json().catch(() => ({}));
    const { ebookId } = body2;
    const testMode = body2.test_mode === true;
    if (!ebookId) return json({ error: "ebookId obrigatório" }, 400);

    const { data: ebook, error: ebErr } = await supabase
      .from("ebooks").select("*").eq("id", ebookId).eq("user_id", userId).single();
    if (ebErr || !ebook) return json({ error: "Ebook não encontrado" }, 404);
    if (ebook.status !== "completed") return json({ error: "Aguarde o ebook terminar de ser gerado" }, 400);

    // slug único
    const base = slugify(ebook.title);
    let slug = base;
    let suffix = 0;
    while (true) {
      const { data: ex } = await admin
        .from("sales_pages").select("id, ebook_id").eq("slug", slug).maybeSingle();
      if (!ex || ex.ebook_id === ebookId) break;
      suffix++;
      slug = `${base}-${suffix}`;
    }

    const { data: existing } = await supabase
      .from("sales_pages").select("id").eq("ebook_id", ebookId).maybeSingle();

    let pageId: string;
    if (existing) {
      await admin.from("sales_pages")
        .update({ status: "processing", error_message: null, slug, is_published: true })
        .eq("id", existing.id);
      pageId = existing.id;
    } else {
      const { data: created, error: insErr } = await admin
        .from("sales_pages")
        .insert({
          user_id: userId, ebook_id: ebookId, title: ebook.title, slug,
          html_content: "", is_published: true, status: "processing",
        })
        .select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      pageId = created.id;
    }

    if (testMode) {
      const mockSp = mockSalesData(ebook);
      const title = mockSp.headline;
      const blocks = buildBlocksFromAI(mockSp, title);
      const html = renderBlocksToHtml(blocks, title);
      await admin.from("sales_pages").update({ title, html_content: html, blocks, status: "completed", error_message: null }).eq("id", pageId);
      return json({ pageId, slug, status: "completed", test_mode: true }, 201);
    }

    // @ts-ignore
    EdgeRuntime.waitUntil(processInBackground({ admin, pageId, ebook }));

    return json({ pageId, slug, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
