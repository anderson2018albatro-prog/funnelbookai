// Edge Function: generate-presell
// Ethical presell generation. Extracts metadata from the official product page,
// then asks the AI to write an original presell. NEVER fires affiliate cookies,
// NEVER injects iframes, NEVER auto-redirects. CTAs are real <a> tags only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const VALID_TYPES = ["review", "advertorial", "quiz", "comparativo", "bridge", "vsl", "cookie_notice"];

const DEFAULT_DISCLOSURE =
  "Esta página pode conter links de afiliado. Podemos receber comissão por compras realizadas, sem custo adicional para você.";

const DEFAULT_THEME = { primary: "#6366f1", accent: "#06b6d4", bg: "#ffffff", text: "#0f172a" };

function slugify(s: string) {
  return (s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "presell");
}
function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f >= 0 && l > f) c = c.slice(f, l + 1);
  return c;
}
function isValidUrl(u: string) {
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; }
}

function defaultOrderFor(type: string): string[] {
  switch (type) {
    case "advertorial": return ["topbar","headline","media","story","what_is","how_it_works","benefits","proof","cta","faq"];
    case "quiz": return ["topbar","headline","quiz","cta"];
    case "comparativo": return ["topbar","headline","comparison","benefits","cta","faq"];
    case "bridge": return ["topbar","headline","benefits","cookie_notice","cta"];
    case "vsl": return ["topbar","headline","video","benefits","cta","faq"];
    case "cookie_notice": return ["topbar","headline","cookie_notice","cta"];
    default: return ["topbar","headline","rating","media","intro","what_is","how_it_works","benefits","pros","cons","for_whom","trust_badges","cta","faq"];
  }
}

type Extracted = {
  title: string; description: string;
  og_title: string; og_description: string; og_image: string;
  canonical: string; h1: string; h2: string[];
  price: string; text: string;
};

function extractMeta(html: string, base: string): Extracted {
  const pick = (re: RegExp) => (html.match(re)?.[1] ?? "").trim();
  const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const og_title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const og_description = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  let og_image = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, "").trim();
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 8);
  const price = pick(/(R\$\s?[0-9.,]+|\$\s?[0-9.,]+|€\s?[0-9.,]+)/);
  if (og_image && !og_image.startsWith("http")) {
    try { og_image = new URL(og_image, base).toString(); } catch { /* noop */ }
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 4000);
  return { title, description, og_title, og_description, og_image, canonical, h1, h2, price, text };
}

async function fetchSource(url: string): Promise<{ ok: true; data: Extracted } | { ok: false; reason: string }> {
  if (!url || !isValidUrl(url)) return { ok: false, reason: "URL inválida" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FunnelBookAI/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const html = await res.text();
    return { ok: true, data: extractMeta(html, url) };
  } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

function buildBlocks(p: any, type: string, affUrl: string, productImage: string, disclosure: string) {
  return {
    type, affiliate_url: affUrl,
    order: defaultOrderFor(type),
    disclosure_text: disclosure,
    theme: { ...DEFAULT_THEME },
    data: {
      topbar: { visible: true, text: p.topbar || "Análise independente" },
      headline: { visible: true, title: p.headline ?? "", subtitle: p.subheadline ?? "" },
      rating: { visible: type === "review", stars: typeof p.rating === "number" ? p.rating : 4.7, label: p.rating_label || "Nota geral" },
      media: { visible: !!productImage, image_url: productImage || "", caption: p.media_caption || "" },
      intro: { visible: !!p.intro, text: p.intro ?? "" },
      what_is: { visible: !!p.what_is, title: "O que é", text: p.what_is ?? "" },
      for_whom: { visible: (p.for_whom ?? []).length > 0, title: "Para quem é", items: p.for_whom ?? [] },
      benefits: { visible: (p.benefits ?? []).length > 0, title: "Principais benefícios", items: p.benefits ?? [] },
      pros: { visible: (p.pros ?? []).length > 0, title: "Pontos positivos", items: p.pros ?? [] },
      cons: { visible: (p.cons ?? []).length > 0, title: "Pontos de atenção", items: p.cons ?? [] },
      story: { visible: !!p.story, title: "A história", text: p.story ?? "" },
      how_it_works: { visible: !!p.how_it_works, title: "Como funciona", text: p.how_it_works ?? "" },
      proof: { visible: (p.proof ?? []).length > 0, title: "Provas e argumentos", items: p.proof ?? [] },
      trust_badges: {
        visible: (p.trust_badges ?? []).length > 0,
        items: p.trust_badges ?? ["Compra 100% segura", "Garantia oficial", "Suporte do fabricante"],
      },
      comparison: {
        visible: !!p.comparison, title: "Comparativo",
        product_a: p.comparison?.product_a ?? "Oficial",
        product_b: p.comparison?.product_b ?? "Alternativa",
        rows: p.comparison?.rows ?? [],
        winner: p.comparison?.winner ?? "",
      },
      quiz: {
        visible: (p.quiz?.questions ?? []).length > 0,
        title: p.quiz?.title ?? "Descubra a melhor opção",
        questions: p.quiz?.questions ?? [], result: p.quiz?.result ?? "",
      },
      video: { visible: type === "vsl", title: p.video_title ?? "Assista", video_url: p.video_url ?? "" },
      cookie_notice: {
        visible: type === "bridge" || type === "cookie_notice",
        text: p.cookie_notice ?? "Ao clicar no botão você será redirecionado para o site oficial. Nenhum cookie é definido antes do clique.",
      },
      cta: {
        visible: true,
        text: p.cta_text ?? "Acessar site oficial",
        note: p.cta_note ?? "Você será redirecionado para o site oficial do produto.",
        sticky: true,
      },
      faq: {
        visible: (p.faq ?? []).length > 0,
        title: "Perguntas frequentes",
        items: p.faq ?? [],
      },
    },
  };
}

async function processBg(opts: {
  admin: ReturnType<typeof createClient>; lovableKey: string; presellId: string;
  source_url: string; affiliate_url: string; presell_type: string;
  niche: string; target_audience: string; tone: string; language: string;
  extra_prompt: string; manual_info: string;
}) {
  const { admin, lovableKey, presellId, source_url, affiliate_url, presell_type,
    niche, target_audience, tone, language, extra_prompt, manual_info } = opts;
  try {
    const fetched = source_url ? await fetchSource(source_url) : { ok: false as const, reason: "Sem URL" };
    const info: Extracted | null = fetched.ok ? fetched.data : null;
    const fetchError = fetched.ok ? null : fetched.reason;

    const productImage = info?.og_image ?? "";

    const ctx = `Tipo: ${presell_type}
Nicho: ${niche}
Público-alvo: ${target_audience}
Tom: ${tone}
Idioma: ${language || "pt-BR"}

Página oficial: ${source_url || "(não informada)"}
${info ? `Dados extraídos:
- Título: ${info.title}
- Descrição: ${info.description}
- OG Title: ${info.og_title}
- OG Description: ${info.og_description}
- Canonical: ${info.canonical}
- H1: ${info.h1}
- H2s: ${info.h2.join(" | ")}
- Preço visível: ${info.price}
- Trecho da página: ${info.text.slice(0, 1500)}` : `Não foi possível ler a página oficial${fetchError ? ` (${fetchError})` : ""}.`}
${manual_info ? `\nInformações fornecidas pelo usuário:\n${manual_info}` : ""}

Comando extra: ${extra_prompt || "(nenhum)"}`;

    const raw = await chatCompletion([
      { role: "system", content:
        "Você é um copywriter de alta conversão especializado em presells éticas para afiliados. Escreva conteúdo ORIGINAL, persuasivo e mobile-first. NUNCA copie literalmente textos da página oficial — use como referência. NUNCA recomende cookie stuffing, redirecionamento invisível ou cookie antes do clique. O CTA SEMPRE depende de um clique real do usuário. Responda APENAS com JSON válido, sem markdown e sem cercas." },
      { role: "user", content: `Crie uma presell premium (tipo "${presell_type}") com base no contexto abaixo. Gere texto original e persuasivo, com headline forte e benefícios claros.

${ctx}

Retorne JSON com:
{
 "topbar": string,
 "headline": string,
 "subheadline": string,
 "rating": number (0-5, apenas para review),
 "rating_label": string,
 "media_caption": string,
 "intro": string,
 "what_is": string,
 "for_whom": string[],
 "benefits": string[],
 "pros": string[],
 "cons": string[],
 "story": string,
 "how_it_works": string,
 "proof": string[],
 "trust_badges": string[],
 "comparison": {"product_a":string,"product_b":string,"rows":[{"feature":string,"a":string,"b":string}],"winner":string} | null,
 "quiz": {"title":string,"questions":[{"question":string,"options":string[]}],"result":string} | null,
 "video_title": string,
 "video_url": string,
 "cookie_notice": string,
 "cta_text": string,
 "cta_note": string,
 "faq": [{"q":string,"a":string}]
}` },
    ]);
    if (!raw) throw new Error("Resposta vazia da IA");
    const p = JSON.parse(stripFences(raw));

    const blocks = buildBlocks(p, presell_type, affiliate_url, productImage, DEFAULT_DISCLOSURE);
    const title = p.headline || info?.og_title || info?.title || "Presell";

    const { error } = await admin.from("presells").update({
      title, blocks, status: "completed", error_message: null,
      extracted_data: info ?? { _error: fetchError },
      product_image_url: productImage || null,
      disclosure_text: DEFAULT_DISCLOSURE,
    }).eq("id", presellId);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = (e as Error).message ?? "Falha";
    console.error("[generate-presell]", presellId, msg);
    await admin.from("presells").update({ status: "failed", error_message: msg }).eq("id", presellId);
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
    let { source_url = "", affiliate_url = "", presell_type = "review",
      niche = "", target_audience = "", tone = "", language = "pt-BR",
      extra_prompt = "", manual_info = "" } = body;

    affiliate_url = String(affiliate_url || "").trim();
    if (!affiliate_url) return json({ error: "Informe o link de afiliado" }, 400);
    if (!isValidUrl(affiliate_url)) return json({ error: "Link de afiliado inválido. Use http(s)://" }, 400);
    if (source_url && !isValidUrl(source_url)) return json({ error: "Link da página oficial inválido" }, 400);
    if (!VALID_TYPES.includes(presell_type)) presell_type = "review";

    const hostBase = source_url ? (() => { try { return new URL(source_url).hostname.replace(/^www\./, ""); } catch { return ""; } })() : "";
    const base = slugify(`${hostBase || presell_type}-${presell_type}`);
    let slug = base, n = 0;
    while (true) {
      const { data: ex } = await admin.from("presells").select("id").eq("slug", slug).maybeSingle();
      if (!ex) break;
      n++; slug = `${base}-${n}`;
    }

    const { data: created, error: insErr } = await admin.from("presells").insert({
      user_id: userId, title: "Presell em geração", slug,
      source_url, affiliate_url, presell_type, tone, language,
      status: "processing", is_published: true,
      disclosure_text: DEFAULT_DISCLOSURE,
    }).select("id").single();
    if (insErr) return json({ error: insErr.message }, 500);

    // @ts-ignore EdgeRuntime
    EdgeRuntime.waitUntil(processBg({
      admin, lovableKey: lovableKey ?? "", presellId: created.id,
      source_url, affiliate_url, presell_type, niche, target_audience, tone, language,
      extra_prompt, manual_info,
    }));

    return json({ presellId: created.id, slug, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
