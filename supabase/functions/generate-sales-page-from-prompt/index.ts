// Edge Function: generate-sales-page-from-prompt
// Gera página de vendas a partir de um prompt livre (sem ebook).
// Suporta test_mode: true para gerar conteúdo mock sem chamar IA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";

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
function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f >= 0 && l > f) c = c.slice(f, l + 1);
  return c;
}

function buildBlocks(sp: any, fallbackTitle: string) {
  const testimonials = [
    { name: "Maria S.", text: "Conteúdo incrível, me ajudou muito!", stars: 5, placeholder: true },
    { name: "João P.", text: "Exatamente o que eu precisava para avançar.", stars: 5, placeholder: true },
    { name: "Ana R.", text: "Linguagem clara e prática. Recomendo!", stars: 4, placeholder: true },
  ];
  return {
    order: ["hero","product","promessa","beneficios","para_quem","aprendizado","bonus","depoimentos","oferta","garantia","faq","final_cta"],
    data: {
      hero: { visible: true, headline: sp.headline ?? fallbackTitle, subheadline: sp.subheadline ?? "", cta_text: sp.cta ?? "Quero agora" },
      product: { visible: false, image_url: "", video_url: "" },
      promessa: { visible: true, title: "A grande promessa", text: sp.promessa_principal ?? "" },
      beneficios: { visible: true, title: "Benefícios", items: sp.beneficios ?? [] },
      para_quem: { visible: true, title: "Para quem é", items: sp.para_quem ?? [] },
      aprendizado: { visible: true, title: "O que você vai aprender", items: sp.aprendizado ?? [] },
      bonus: { visible: (sp.bonus ?? []).length > 0, title: "🎁 Bônus exclusivos", items: sp.bonus ?? [] },
      depoimentos: { visible: true, title: "O que dizem os leitores", items: testimonials, is_placeholder: true },
      oferta: { visible: true, title: "Oferta especial", description: sp.oferta ?? "", price: sp.price ?? "", cta_text: sp.cta ?? "Quero agora", cta_url: sp.button_url ?? "#cta-final" },
      garantia: { visible: !!sp.garantia, title: "✅ Garantia", text: sp.garantia ?? "" },
      faq: { visible: (sp.faq ?? []).length > 0, title: "Perguntas frequentes", items: sp.faq ?? [] },
      final_cta: { visible: true, headline: sp.headline ?? fallbackTitle, cta_text: sp.cta ?? "Garantir o meu agora", cta_url: sp.button_url ?? "#" },
    },
  };
}

function buildHtml(sp: any, title: string, buttonUrl: string) {
  const list = (arr: string[] = []) => arr.map((b) => `<li>${esc(b)}</li>`).join("");
  const faq = (sp.faq ?? []).map((f: any) =>
    `<details><summary>${esc(f.pergunta ?? f.q ?? "")}</summary><p>${esc(f.resposta ?? f.a ?? "")}</p></details>`
  ).join("");
  const url = buttonUrl || "#cta-final";
  const testimonials = [
    { name: "Maria S.", text: "Conteúdo incrível, me ajudou muito!", stars: 5 },
    { name: "João P.", text: "Exatamente o que eu precisava para avançar.", stars: 5 },
    { name: "Ana R.", text: "Linguagem clara e prática. Recomendo!", stars: 4 },
  ];
  const testimonialsHtml = testimonials.map((t) =>
    `<div class="testimonial"><div class="t-stars">${"⭐".repeat(t.stars)}</div><p class="t-text">"${esc(t.text)}"</p><strong class="t-name">— ${esc(t.name)}</strong></div>`
  ).join("");
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(sp.headline ?? title)}</title>
<meta name="description" content="${esc(sp.subheadline ?? "")}"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;background:#fff}
.wrap{max-width:880px;margin:0 auto;padding:24px 16px}
.hero{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:64px 16px;text-align:center}
.hero h1{font-size:clamp(28px,5vw,52px);font-weight:800;line-height:1.15;max-width:880px;margin:0 auto}
.hero p{font-size:clamp(16px,2.4vw,20px);opacity:.95;max-width:720px;margin:18px auto 0}
.cta{display:inline-block;background:#fff;color:#6366f1;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;margin-top:28px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
section{padding:48px 0;border-bottom:1px solid #e5e7eb}
h2{font-size:clamp(22px,3vw,32px);margin-bottom:20px;text-align:center}
.promise{background:#f8fafc;padding:32px;border-radius:16px;text-align:center;font-size:18px;font-weight:500}
ul.feat{list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
ul.feat li{background:#f1f5f9;padding:16px 20px;border-radius:12px;border-left:4px solid #6366f1}
.testimonials{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.testimonial{background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:20px}
.t-stars{font-size:18px;margin-bottom:8px}.t-text{font-style:italic;color:#334155;margin-bottom:10px}.t-name{font-size:14px;color:#64748b}
.placeholder-notice{text-align:center;font-size:12px;color:#94a3b8;margin-top:12px;font-style:italic}
.offer{background:linear-gradient(135deg,#f5f3ff,#ede9fe);padding:40px;border-radius:20px;text-align:center}
.offer .cta{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
.bonus{background:#fef3c7;padding:24px;border-radius:14px}.bonus h3{margin-bottom:12px;color:#92400e}.bonus ul{padding-left:20px}
.guarantee{background:#ecfdf5;border:2px solid #10b981;padding:28px;border-radius:16px;text-align:center}.guarantee h3{color:#065f46;margin-bottom:10px}
details{background:#f8fafc;padding:16px 20px;border-radius:10px;margin-bottom:10px;cursor:pointer}
details summary{font-weight:600;list-style:none}
.final{background:#0f172a;color:#fff;padding:64px 16px;text-align:center}.final h2{color:#fff}
.final .cta{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
footer{padding:24px;text-align:center;color:#64748b;font-size:13px}
</style></head><body>
<header class="hero">
  <h1>${esc(sp.headline ?? title)}</h1>
  <p>${esc(sp.subheadline ?? "")}</p>
  <a class="cta" href="${esc(url)}">${esc(sp.cta ?? "Quero agora")}</a>
</header>
<section class="wrap"><h2>A grande promessa</h2><div class="promise">${esc(sp.promessa_principal ?? "")}</div></section>
${(sp.beneficios ?? []).length ? `<section class="wrap"><h2>Benefícios</h2><ul class="feat">${list(sp.beneficios)}</ul></section>` : ""}
${(sp.para_quem ?? []).length ? `<section class="wrap"><h2>Para quem é</h2><ul class="feat">${list(sp.para_quem)}</ul></section>` : ""}
${(sp.aprendizado ?? []).length ? `<section class="wrap"><h2>O que você vai aprender</h2><ul class="feat">${list(sp.aprendizado)}</ul></section>` : ""}
<section class="wrap"><h2>O que dizem os leitores</h2>
  <div class="testimonials">${testimonialsHtml}</div>
  <p class="placeholder-notice">⚠️ Depoimentos de exemplo — substitua pelos reais antes de publicar.</p>
</section>
<section class="wrap" id="oferta"><h2>Oferta especial</h2>
  <div class="offer">
    <p style="font-size:20px;margin-bottom:8px">${esc(sp.oferta ?? "")}</p>
    ${sp.price ? `<p style="font-size:36px;font-weight:800;margin-bottom:16px">${esc(sp.price)}</p>` : ""}
    <a class="cta" href="${esc(url)}">${esc(sp.cta ?? "Quero agora")}</a>
  </div>
</section>
${(sp.bonus ?? []).length ? `<section class="wrap"><div class="bonus"><h3>🎁 Bônus exclusivos</h3><ul>${list(sp.bonus)}</ul></div></section>` : ""}
${sp.garantia ? `<section class="wrap"><div class="guarantee"><h3>✅ Garantia</h3><p>${esc(sp.garantia)}</p></div></section>` : ""}
${faq ? `<section class="wrap"><h2>Perguntas frequentes</h2>${faq}</section>` : ""}
<section class="final" id="cta-final">
  <h2>${esc(sp.headline ?? title)}</h2>
  <a class="cta" href="${esc(url)}">${esc(sp.cta ?? "Garantir o meu agora")}</a>
</section>
<footer>Criado com FunnelBook AI</footer>
</body></html>`;
}

function mockSalesData(form: any): any {
  const name = form.product_name || "Produto Incrível";
  return {
    headline: `Descubra como ${name} pode transformar sua vida em 30 dias`,
    subheadline: `O método definitivo para ${form.niche || "seu nicho"} que já ajudou mais de 1.000 pessoas`,
    promessa_principal: form.promessa || `Com ${name} você vai alcançar resultados reais e duradouros sem complicação`,
    beneficios: [
      "Resultados visíveis em menos de 30 dias",
      "Método simples e comprovado cientificamente",
      "Suporte completo durante toda a jornada",
      "Acesso vitalício ao conteúdo atualizado",
      "Comunidade exclusiva de membros",
    ],
    para_quem: [
      `Pessoas interessadas em ${form.niche || "crescimento pessoal"}`,
      "Quem quer resultados rápidos e duradouros",
      "Iniciantes e avançados",
    ],
    aprendizado: [
      "Fundamentos essenciais para começar com o pé direito",
      "Estratégias avançadas para acelerar seus resultados",
      "Como manter a consistência e não desistir",
      "Ferramentas práticas que você pode usar agora mesmo",
    ],
    oferta: form.offer || "Acesso completo por apenas 12x de R$ 19,70",
    price: form.offer ? "" : "R$ 197",
    bonus: ["Bônus 1: Guia rápido de implementação (valor R$ 47)", "Bônus 2: Planilha de acompanhamento (valor R$ 27)"],
    garantia: "Garantia de 30 dias: se não gostar, devolvemos 100% do seu dinheiro",
    faq: [
      { pergunta: "Para quem é esse produto?", resposta: `Para ${form.target_audience || "qualquer pessoa"} que quer resultados reais.` },
      { pergunta: "Como acesso após a compra?", resposta: "Você recebe o acesso por e-mail em até 5 minutos após a confirmação." },
      { pergunta: "Tem garantia?", resposta: "Sim! 30 dias de garantia incondicional." },
    ],
    cta: "Quero garantir meu acesso agora",
    button_url: form.button_url || "#",
  };
}

async function processInBackground(opts: {
  admin: ReturnType<typeof createClient>;
  pageId: string;
  form: any;
}) {
  const { admin, pageId, form } = opts;
  try {
    const prompt = `Você é um copywriter de alta conversão. Crie uma página de vendas em ${form.language || "pt-BR"} com tom "${form.tone || "persuasivo"}" para o tipo "${form.page_type || "vendas"}".

Produto: ${form.product_name || "(não informado)"}
Nicho: ${form.niche || "(não informado)"}
Público-alvo: ${form.target_audience || "(não informado)"}
Oferta: ${form.offer || "(não informada)"}
Link do botão: ${form.button_url || ""}
Comando extra do usuário: ${form.prompt || ""}

Retorne APENAS JSON válido:
{
  "headline": string,
  "subheadline": string,
  "promessa_principal": string,
  "beneficios": string[],
  "para_quem": string[],
  "aprendizado": string[],
  "oferta": string,
  "price": string,
  "bonus": string[],
  "garantia": string,
  "faq": [{ "pergunta": string, "resposta": string }],
  "cta": string,
  "button_url": string
}`;

    const raw = await chatCompletion([
      { role: "system", content: "Você é um copywriter de alta conversão. Responda APENAS com JSON válido, sem markdown, sem cercas de código (```), sem texto fora do JSON." },
      { role: "user", content: prompt },
    ], 2500);
    if (!raw) throw new Error("Resposta vazia da IA");
    const sp = JSON.parse(stripFences(raw));
    sp.button_url = sp.button_url || form.button_url || "#";
    const title = sp.headline ?? form.product_name ?? "Página de Vendas";
    const html = buildHtml(sp, title, sp.button_url);
    const blocks = buildBlocks(sp, title);
    const { error } = await admin.from("sales_pages").update({
      title, html_content: html, blocks, status: "completed", error_message: null,
    }).eq("id", pageId);
    if (error) throw new Error(error.message);
    console.log("[generate-sales-page-from-prompt] concluído", pageId);
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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const testMode = body.test_mode === true;

    if (!testMode && !lovableKey && !openaiKey) {
      return json({ error: "Configure LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    }

    const form = {
      prompt: String(body.prompt ?? ""),
      product_name: String(body.product_name ?? ""),
      niche: String(body.niche ?? ""),
      target_audience: String(body.target_audience ?? ""),
      promessa: String(body.promessa ?? ""),
      offer: String(body.offer ?? ""),
      button_url: String(body.button_url ?? ""),
      language: String(body.language ?? "pt-BR"),
      tone: String(body.tone ?? "persuasivo"),
      page_type: String(body.page_type ?? "vendas"),
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
      // Mock: gera conteúdo sem IA, sem crédito
      const mockData = mockSalesData(form);
      const title = mockData.headline;
      const html = buildHtml(mockData, title, form.button_url || "#");
      const blocks = buildBlocks(mockData, title);
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
