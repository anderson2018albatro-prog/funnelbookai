// Edge Function: generate-sales-page-from-prompt
// "Criar com IA": gera página de vendas a partir de um comando livre.
// A IA primeiro decide a MELHOR estrutura (vsl, carta longa, lançamento,
// low ticket, high ticket, assinatura) e depois escreve copy brasileira de
// resposta direta completa. Suporta:
//   - test_mode: true → conteúdo mock sem IA
//   - action: "regenerate_section" → regenera UMA seção sem refazer a página
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";
import { jsonrepair } from "https://esm.sh/jsonrepair@3.6.1";
import {
  buildBlocksFromAI, renderBlocksToHtml, backfillBlocks,
  type SalesBlocks, type BlockKey,
} from "../_shared/sales-blocks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function slugify(input: string) {
  return (input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "pagina");
}
function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f >= 0 && l > f) c = c.slice(f, l + 1);
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

function mainPrompt(form: any): string {
  return `Crie uma página de vendas COMPLETA em ${form.language || "pt-BR"}, tom "${form.tone || "persuasivo"}".

PEDIDO DO USUÁRIO (comando livre):
"${form.prompt || "(sem comando livre — use o briefing abaixo)"}"

BRIEFING ADICIONAL:
- Produto/Serviço: ${form.product_name || "(deduza do comando)"}
- Nicho: ${form.niche || "(deduza do comando)"}
- Público-alvo: ${form.target_audience || "(deduza do comando)"}
- Promessa: ${form.promessa || "(deduza)"}
- Dor do cliente: ${form.dor_principal || "(deduza)"}
- Resultado esperado: ${form.resultado_esperado || "(deduza)"}
- Oferta/Preço: ${form.offer || "(deduza do comando; se não houver, sugira)"}
- Garantia: ${form.garantia || "(sugira garantia incondicional)"}
- Link do botão (checkout Hotmart/Kiwify): ${form.button_url || "#"}

PASSO 1 — ESCOLHA A ESTRUTURA. Analise o pedido (tipo de produto, preço, nicho, público) e escolha a MELHOR estrutura no campo "estrutura":
- "vsl": página de VSL — headline + vídeo + bullets + oferta (produtos que dependem de vídeo de vendas)
- "carta": carta de vendas longa PAS completo (problema-agitação-solução; produtos que precisam de convencimento)
- "lancamento": página de lançamento estilo Hotmart/Kiwify (cursos com abertura de carrinho)
- "low_ticket": direto ao ponto (preço até ~R$97, decisão por impulso)
- "high_ticket": autoridade + prova social pesada (acima de ~R$997, mentorias)
- "assinatura": recorrência/clube (mensalidades)

PASSO 2 — COPY BRASILEIRA DE RESPOSTA DIRETA (obrigatório em todas):
- headline: big idea + benefício + curiosidade (mínimo 8 palavras, específica)
- subheadline: aprofunda a promessa (mínimo 12 palavras)
- dor_lead: lead que AGITA a dor do público — 2-3 parágrafos separados por \\n\\n, específicos do nicho
- mecanismo: NOMEIE o mecanismo único (nome próprio memorável, ex: "Método Trinca 3x7") + descrição de por que funciona quando tudo falhou
- beneficios: MÍNIMO 8 bullets de fascínio (curiosidade + benefício, ex: "O erro nº 1 que faz seus bolos solarem — e como corrigir em 5 min")
- para_quem: mínimo 5 perfis específicos
- aprendizado: mínimo 6 tópicos concretos
- stack: stack da oferta com ancoragem — mínimo 4 itens, cada um com valor percebido (ex: {"item":"Curso completo com 40 aulas","valor":"R$497"})
- valor_total: soma ancorada (ex: "R$1.244")
- price: preço real formatado (ex: "12x R$9,74 ou R$97 à vista")
- ancoragem: 1 frase de ancoragem de preço (ex: "Menos que uma pizza por mês")
- bonus: mínimo 3 bônus COM valores (ex: "Bônus 1: Planilha de precificação (valor R$67)")
- garantia: garantia INCONDICIONAL destacada, com prazo
- urgencia: escassez/urgência ÉTICA e real (turma, bônus por tempo limitado, aumento de preço) — NUNCA invente contadores falsos
- faq: mínimo 5 perguntas quebrando objeções REAIS do nicho ("não tenho tempo", "já tentei antes", preço, acesso, garantia)
- cta: texto de botão urgente
- oferta: resumo da oferta em 1-2 frases

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
  "button_url": "${form.button_url || "#"}"
}`;
}

// Campos regeneráveis por seção: como pedir e como aplicar no bloco
const SECTION_SPECS: Record<string, { ask: string; schema: string }> = {
  hero: { ask: "a headline (big idea + benefício + curiosidade), subheadline e texto do CTA", schema: `{"headline": string, "subheadline": string, "cta_text": string}` },
  dor: { ask: "o lead que agita a dor do público (2-3 parágrafos com \\n\\n)", schema: `{"title": string, "text": string}` },
  mecanismo: { ask: "o mecanismo único nomeado (nome próprio + descrição)", schema: `{"nome": string, "text": string}` },
  promessa: { ask: "a promessa principal transformacional", schema: `{"title": string, "text": string}` },
  beneficios: { ask: "mínimo 8 bullets de fascínio", schema: `{"title": string, "items": string[]}` },
  para_quem: { ask: "mínimo 5 perfis de público", schema: `{"title": string, "items": string[]}` },
  aprendizado: { ask: "mínimo 6 tópicos de aprendizado", schema: `{"title": string, "items": string[]}` },
  stack: { ask: "o stack da oferta com ancoragem de valores", schema: `{"title": string, "items": [{"item": string, "valor": string}], "total_value": string, "anchor_text": string}` },
  bonus: { ask: "mínimo 3 bônus com valores", schema: `{"title": string, "items": string[]}` },
  oferta: { ask: "a descrição da oferta e preço", schema: `{"title": string, "description": string, "price": string, "cta_text": string}` },
  garantia: { ask: "a garantia incondicional destacada", schema: `{"title": string, "text": string}` },
  urgencia: { ask: "a escassez/urgência ética (sem contadores falsos)", schema: `{"title": string, "text": string}` },
  faq: { ask: "mínimo 5 FAQs quebrando objeções reais", schema: `{"title": string, "items": [{"pergunta": string, "resposta": string}]}` },
  final_cta: { ask: "a headline final e texto do botão", schema: `{"headline": string, "cta_text": string}` },
  video_vsl: { ask: "o título da seção de vídeo", schema: `{"title": string, "placeholder_text": string}` },
};

function mockSalesData(form: any): any {
  const name = form.product_name || "Produto Incrível";
  return {
    estrutura: "carta",
    headline: `Descubra como ${name} pode transformar sua vida em 30 dias`,
    subheadline: `O método definitivo para ${form.niche || "seu nicho"} que já ajudou mais de 1.000 pessoas`,
    dor_titulo: "Você se identifica com isso?",
    dor_lead: `Você já tentou de tudo em ${form.niche || "sua área"} e nada funcionou.\n\nA cada nova tentativa, a frustração aumenta — e a sensação de que o problema é você.\n\n[MODO MOCK]`,
    mecanismo: { nome: "Método Tripla Alavanca", descricao: "Um processo em 3 fases que ataca a causa raiz do problema, não os sintomas. [MODO MOCK]" },
    promessa_principal: form.promessa || `Com ${name} você vai alcançar resultados reais e duradouros sem complicação`,
    beneficios: [
      "Resultados visíveis em menos de 30 dias",
      "O erro nº 1 que trava seus resultados — e como corrigir hoje",
      "Método simples e comprovado, passo a passo",
      "Suporte completo durante toda a jornada",
      "Acesso vitalício ao conteúdo atualizado",
      "Comunidade exclusiva de membros",
      "Como começar mesmo sem experiência nenhuma",
      "A rotina de 15 minutos que muda o jogo",
    ],
    para_quem: [
      `Pessoas interessadas em ${form.niche || "crescimento pessoal"}`,
      "Quem quer resultados rápidos e duradouros",
      "Iniciantes sem nenhuma base",
      "Quem já tentou outras soluções sem sucesso",
      "Quem tem pouco tempo disponível",
    ],
    aprendizado: [
      "Fundamentos essenciais para começar com o pé direito",
      "Estratégias avançadas para acelerar seus resultados",
      "Como manter a consistência e não desistir",
      "Ferramentas práticas que você pode usar agora mesmo",
      "Os atalhos que ninguém te conta",
      "Plano de 90 dias pronto para aplicar",
    ],
    stack: [
      { item: "Curso completo com todas as aulas", valor: "R$497" },
      { item: "Materiais de apoio e templates", valor: "R$197" },
      { item: "Comunidade exclusiva", valor: "R$297" },
      { item: "Atualizações vitalícias", valor: "R$253" },
    ],
    valor_total: "R$1.244",
    price: form.offer || "12x de R$19,70 ou R$197 à vista",
    ancoragem: "Menos que um lanche por mês para transformar seus resultados",
    oferta: form.offer || "Acesso completo por apenas 12x de R$ 19,70",
    bonus: ["Bônus 1: Guia rápido de implementação (valor R$47)", "Bônus 2: Planilha de acompanhamento (valor R$27)", "Bônus 3: Aula extra ao vivo (valor R$97)"],
    garantia: form.garantia || "Garantia incondicional de 30 dias: se não gostar, devolvemos 100% do seu dinheiro",
    urgencia: "Os bônus desta página ficam disponíveis apenas nesta condição de lançamento. Na próxima turma, o preço sobe.",
    faq: [
      { pergunta: "Para quem é esse produto?", resposta: `Para ${form.target_audience || "qualquer pessoa"} que quer resultados reais.` },
      { pergunta: "Não tenho tempo. Funciona para mim?", resposta: "Sim — o método foi desenhado para 15 minutos por dia." },
      { pergunta: "Já tentei antes e não funcionou.", resposta: "Por isso o mecanismo ataca a causa raiz, não os sintomas." },
      { pergunta: "Como acesso após a compra?", resposta: "Você recebe o acesso por e-mail em até 5 minutos após a confirmação." },
      { pergunta: "Tem garantia?", resposta: "Sim! 30 dias de garantia incondicional." },
    ],
    cta: "Quero garantir meu acesso agora",
    video_titulo: "Assista ao vídeo até o final",
    button_url: form.button_url || "#",
    theme: form.theme || "clean",
  };
}

async function processInBackground(opts: {
  admin: ReturnType<typeof createClient>;
  pageId: string;
  form: any;
}) {
  const { admin, pageId, form } = opts;
  try {
    const raw = await chatCompletion([
      { role: "system", content: SYSTEM },
      { role: "user", content: mainPrompt(form) },
    ], 5000);
    if (!raw) throw new Error("Resposta vazia da IA");
    const sp = parseLoose(raw);
    sp.button_url = sp.button_url || form.button_url || "#";
    sp.theme = form.theme || "clean";
    const title = sp.headline ?? form.product_name ?? "Página de Vendas";
    const blocks = buildBlocksFromAI(sp, title);
    const html = renderBlocksToHtml(blocks, title);
    const { error } = await admin.from("sales_pages").update({
      title, html_content: html, blocks, status: "completed", error_message: null,
    }).eq("id", pageId);
    if (error) throw new Error(error.message);
    console.log("[generate-sales-page-from-prompt] concluído", pageId, "estrutura:", sp.estrutura);
  } catch (e) {
    const msg = (e as Error).message ?? "Falha";
    console.error("[generate-sales-page-from-prompt] falhou", pageId, msg);
    await admin.from("sales_pages").update({ status: "failed", error_message: msg }).eq("id", pageId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const testMode = body.test_mode === true;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!testMode && !anthropicKey && !lovableKey && !geminiKey && !openaiKey) {
      return json({ error: "Configure ANTHROPIC_API_KEY, GEMINI_API_KEY (gratuito), LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    }

    // ── Ação: regenerar UMA seção sem refazer a página ─────────────────────
    if (body.action === "regenerate_section") {
      const pageId = String(body.page_id ?? "");
      const section = String(body.section ?? "") as BlockKey;
      const instruction = String(body.instruction ?? "");
      const spec = SECTION_SPECS[section];
      if (!pageId || !spec) return json({ error: "page_id e section válidos são obrigatórios" }, 400);

      // client do usuário: RLS garante que só o dono lê/edita
      const { data: page, error: pErr } = await supabase.from("sales_pages").select("*").eq("id", pageId).single();
      if (pErr || !page) return json({ error: "Página não encontrada" }, 404);
      const blocks = backfillBlocks((page.blocks ?? { order: [], data: {} }) as SalesBlocks);
      const current = (blocks.data as any)[section] ?? {};

      const raw = await chatCompletion([
        { role: "system", content: SYSTEM },
        { role: "user", content: `A página de vendas abaixo já existe. Regenere APENAS ${spec.ask}.

CONTEXTO DA PÁGINA:
- Headline atual: ${blocks.data.hero?.headline ?? page.title}
- Subheadline: ${blocks.data.hero?.subheadline ?? ""}
- Estrutura: ${blocks.structure ?? "carta"}
- Conteúdo atual da seção "${section}": ${JSON.stringify(current).slice(0, 1500)}
${instruction ? `- Instrução do usuário: ${instruction}` : ""}

Mantenha coerência com a headline e o nicho. Escreva em português brasileiro, copy de resposta direta.
Retorne APENAS o JSON no formato: ${spec.schema}` },
      ], 1800);
      const patch = parseLoose(raw);
      const merged = { ...current, ...patch, visible: true };
      (blocks.data as any)[section] = merged;
      const title = blocks.data.hero?.headline || page.title;
      const html = renderBlocksToHtml(blocks, title);
      const { error: uErr } = await admin.from("sales_pages")
        .update({ blocks, html_content: html, title }).eq("id", pageId);
      if (uErr) return json({ error: uErr.message }, 500);
      return json({ ok: true, section, block: merged, blocks });
    }

    // ── Criação normal ──────────────────────────────────────────────────────
    const form = {
      prompt: String(body.prompt ?? ""),
      product_name: String(body.product_name ?? ""),
      niche: String(body.niche ?? ""),
      target_audience: String(body.target_audience ?? ""),
      promessa: String(body.promessa ?? ""),
      dor_principal: String(body.dor_principal ?? ""),
      resultado_esperado: String(body.resultado_esperado ?? ""),
      offer: String(body.offer ?? ""),
      garantia: String(body.garantia ?? ""),
      button_url: String(body.button_url ?? ""),
      language: String(body.language ?? "pt-BR"),
      tone: String(body.tone ?? "persuasivo"),
      page_type: String(body.page_type ?? "vendas"),
      theme: ["clean", "dark", "highconvert"].includes(body.theme) ? String(body.theme) : "clean",
    };

    if (!form.prompt && !form.product_name) {
      return json({ error: "Informe um comando ou o nome do produto" }, 400);
    }

    // slug único
    const base = slugify(form.product_name || form.prompt.slice(0, 40) || "pagina");
    let slug = base, n = 0;
    while (true) {
      const { data: ex } = await admin.from("sales_pages").select("id").eq("slug", slug).maybeSingle();
      if (!ex) break;
      n++;
      slug = `${base}-${n}`;
    }

    if (testMode) {
      const mockData = mockSalesData(form);
      const title = mockData.headline;
      const blocks = buildBlocksFromAI(mockData, title);
      const html = renderBlocksToHtml(blocks, title);
      const { data: created, error: insErr } = await admin.from("sales_pages").insert({
        user_id: userId, title, slug, html_content: html, blocks,
        is_published: true, status: "completed",
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      return json({ salesPageId: created.id, slug, status: "completed", test_mode: true }, 201);
    }

    // Real: cria como processing, gera em background
    const { data: created, error: insErr } = await admin.from("sales_pages").insert({
      user_id: userId, title: form.product_name || "Nova Página", slug,
      html_content: "", is_published: true, status: "processing",
    }).select("id").single();
    if (insErr) return json({ error: insErr.message }, 500);

    // @ts-ignore
    EdgeRuntime.waitUntil(processInBackground({ admin, pageId: created.id, form }));

    return json({ salesPageId: created.id, slug, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
