// Edge Function: generate-sales-page-from-prompt
// Creates a sales_pages row from a free-form AI prompt (no ebook required).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function slugify(s: string) {
  return (s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "pagina");
}
function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f >= 0 && l > f) c = c.slice(f, l + 1);
  return c;
}

function buildBlocks(sp: any, fallbackTitle: string, buttonUrl: string) {
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
      depoimentos: { visible: false, title: "O que dizem", items: [] },
      oferta: { visible: true, title: "Oferta especial", description: sp.oferta ?? "", price: sp.preco ?? "", cta_text: sp.cta ?? "Quero agora", cta_url: buttonUrl || "#cta-final" },
      garantia: { visible: !!sp.garantia, title: "✅ Garantia", text: sp.garantia ?? "" },
      faq: { visible: (sp.faq ?? []).length > 0, title: "Perguntas frequentes", items: sp.faq ?? [] },
      final_cta: { visible: true, headline: sp.headline ?? fallbackTitle, cta_text: sp.cta ?? "Garantir o meu agora", cta_url: buttonUrl || "#" },
    },
  };
}

function buildHtml(sp: any, title: string, buttonUrl: string) {
  const list = (arr: string[] = []) => arr.map((b) => `<li>${esc(b)}</li>`).join("");
  const benef = list(sp.beneficios), bul = list(sp.aprendizado), pq = list(sp.para_quem), bonus = list(sp.bonus);
  const faq = (sp.faq ?? []).map((f: any) => `<details><summary>${esc(f.pergunta)}</summary><p>${esc(f.resposta)}</p></details>`).join("");
  const url = buttonUrl || "#cta-final";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(sp.headline ?? title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;line-height:1.6;color:#0f172a;background:#fff}
.wrap{max-width:880px;margin:0 auto;padding:24px 16px}
.hero{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:64px 16px;text-align:center}
.hero h1{font-size:clamp(28px,5vw,52px);font-weight:800}.hero p{font-size:clamp(16px,2.4vw,20px);opacity:.95;margin-top:18px}
.cta{display:inline-block;background:#fff;color:#6366f1;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;margin-top:28px}
section{padding:48px 0;border-bottom:1px solid #e5e7eb}h2{font-size:clamp(22px,3vw,32px);margin-bottom:20px;text-align:center}
ul.feat{list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
ul.feat li{background:#f1f5f9;padding:16px 20px;border-radius:12px;border-left:4px solid #6366f1}
.offer{background:linear-gradient(135deg,#f5f3ff,#ede9fe);padding:40px;border-radius:20px;text-align:center}
.final{background:#0f172a;color:#fff;padding:64px 16px;text-align:center}.final .cta{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
details{background:#f8fafc;padding:16px;border-radius:10px;margin-bottom:10px}details summary{font-weight:600}
</style></head><body>
<header class="hero"><h1>${esc(sp.headline ?? title)}</h1><p>${esc(sp.subheadline ?? "")}</p><a class="cta" href="#oferta">${esc(sp.cta ?? "Quero agora")}</a></header>
${benef ? `<section class="wrap"><h2>Benefícios</h2><ul class="feat">${benef}</ul></section>` : ""}
${pq ? `<section class="wrap"><h2>Para quem é</h2><ul class="feat">${pq}</ul></section>` : ""}
${bul ? `<section class="wrap"><h2>O que você vai aprender</h2><ul class="feat">${bul}</ul></section>` : ""}
<section class="wrap" id="oferta"><h2>Oferta</h2><div class="offer"><p style="font-size:20px;margin-bottom:20px">${esc(sp.oferta ?? "")}</p>${sp.preco ? `<p style="font-size:28px;font-weight:800;color:#6366f1;margin-bottom:14px">${esc(sp.preco)}</p>` : ""}<a class="cta" href="${esc(url)}">${esc(sp.cta ?? "Quero agora")}</a></div></section>
${bonus ? `<section class="wrap"><h2>Bônus</h2><ul class="feat">${bonus}</ul></section>` : ""}
${sp.garantia ? `<section class="wrap"><h2>Garantia</h2><p style="text-align:center">${esc(sp.garantia)}</p></section>` : ""}
${faq ? `<section class="wrap"><h2>FAQ</h2>${faq}</section>` : ""}
<section class="final"><h2>${esc(sp.headline ?? title)}</h2><a class="cta" href="${esc(url)}">${esc(sp.cta ?? "Garantir agora")}</a></section>
</body></html>`;
}

async function processBg(opts: {
  admin: ReturnType<typeof createClient>; lovableKey: string; pageId: string;
  prompt: string; product_name: string; niche: string; target_audience: string;
  offer: string; button_url: string; language: string; tone: string; page_type: string;
}) {
  const { admin, lovableKey, pageId, prompt, product_name, niche, target_audience, offer, button_url, language, tone, page_type } = opts;
  try {
    const ctx = `Comando do usuário: ${prompt}
Produto: ${product_name}
Nicho: ${niche}
Público-alvo: ${target_audience}
Oferta/preço: ${offer}
Idioma: ${language || "pt-BR"}
Tom de voz: ${tone || "persuasivo"}
Tipo de página: ${page_type}`;
    const raw = await chatCompletion([
      { role: "system", content: "Você é um copywriter de alta conversão. Responda APENAS com JSON válido, sem markdown e sem cercas de código." },
      { role: "user", content: `Crie uma página de vendas no idioma ${language || "pt-BR"} com base em:
${ctx}

Retorne JSON:
{"headline":string,"subheadline":string,"promessa_principal":string,"beneficios":string[],"para_quem":string[],"aprendizado":string[],"oferta":string,"preco":string,"bonus":string[],"garantia":string,"faq":[{"pergunta":string,"resposta":string}],"cta":string}` },
    ]);
    if (!raw) throw new Error("Resposta vazia da IA");
    const sp = JSON.parse(stripFences(raw));
    const title = sp.headline ?? product_name ?? "Página de vendas";
    const html = buildHtml(sp, title, button_url);
    const blocks = buildBlocks(sp, title, button_url);
    const { error } = await admin.from("sales_pages")
      .update({ title, html_content: html, blocks, status: "completed", error_message: null }).eq("id", pageId);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = (e as Error).message ?? "Falha";
    console.error("[generate-sales-page-from-prompt]", pageId, msg);
    await admin.from("sales_pages").update({ status: "failed", error_message: msg }).eq("id", pageId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY ausente" }, 500);
    if (!lovableKey && !openaiKey) return json({ error: "Configure LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    const supabase = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      prompt = "", product_name = "Produto", niche = "", target_audience = "",
      offer = "", button_url = "", language = "pt-BR", tone = "persuasivo", page_type = "vendas",
    } = body;
    if (!prompt && !product_name) return json({ error: "Informe um comando ou nome do produto" }, 400);

    const base = slugify(product_name || prompt.slice(0, 40) || "pagina");
    let slug = base, n = 0;
    while (true) {
      const { data: ex } = await admin.from("sales_pages").select("id").eq("slug", slug).maybeSingle();
      if (!ex) break;
      n++; slug = `${base}-${n}`;
    }

    const { data: created, error: insErr } = await admin.from("sales_pages").insert({
      user_id: userId, ebook_id: null, title: product_name || "Página de vendas",
      slug, html_content: "", is_published: true, status: "processing",
    }).select("id").single();
    if (insErr) return json({ error: insErr.message }, 500);

    // @ts-ignore
    EdgeRuntime.waitUntil(processBg({
      admin, lovableKey: lovableKey ?? "", pageId: created.id,
      prompt, product_name, niche, target_audience, offer, button_url, language, tone, page_type,
    }));

    return json({ salesPageId: created.id, slug, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
