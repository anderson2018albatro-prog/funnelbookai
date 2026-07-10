// Edge Function: generate-presell
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const VALID_TYPES = [
  "review", "advertorial", "quiz", "comparativo", "bridge", "bridge_story", "vsl", "cookie_notice",
  "native_ad", "story", "listicle",
  "age_gate", "gender_gate", "country_gate", "captcha_gate", "coupon", "countdown",
];

const GATE_TYPES = ["age_gate", "gender_gate", "country_gate", "captcha_gate"];

const DEFAULT_DISCLOSURE =
  "Esta página pode conter links de afiliado. Podemos receber comissão por compras realizadas, sem custo adicional para você.";

const DEFAULT_THEME = { primary: "#6366f1", accent: "#06b6d4", bg: "#ffffff", text: "#0f172a" };

function slugify(s: string) {
  return (s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "presell");
}

function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f >= 0 && l > f) c = c.slice(f, l + 1);
  return c;
}

// Repara JSON com newlines literais dentro de strings (erro comum das IAs)
function repairJson(s: string): string {
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

function safeJsonParse(raw: string): any {
  const cleaned = repairJson(stripFences(raw));
  try { return JSON.parse(cleaned); }
  catch (e1) {
    // Second attempt: strip everything outside first { ... }
    const f = cleaned.indexOf("{"), l = cleaned.lastIndexOf("}");
    if (f >= 0 && l > f) {
      try { return JSON.parse(cleaned.slice(f, l + 1)); } catch { /* noop */ }
    }
    throw e1;
  }
}

function isValidUrl(u: string) {
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; }
}

function defaultOrderFor(type: string): string[] {
  switch (type) {
    case "advertorial": return ["urgency_bar","topbar","headline","author_byline","media","story","what_is","how_it_works","benefits","proof","testimonials","trust_badges","cta","faq","comments"];
    case "quiz": return ["urgency_bar","topbar","headline","viewers_counter","quiz","testimonials","trust_badges","cta"];
    case "comparativo": return ["urgency_bar","topbar","headline","viewers_counter","comparison","benefits","testimonials","trust_badges","cta","faq"];
    case "bridge": return ["topbar","headline","benefits","testimonials","cookie_notice","cta"];
    // Ponte narrativa ética: sem urgency_bar, viewers_counter, depoimentos fabricados ou popup
    case "bridge_story": return ["topbar","headline","story","how_it_works","benefits","cta"];
    case "vsl": return ["urgency_bar","topbar","headline","viewers_counter","video","benefits","testimonials","trust_badges","cta","faq"];
    case "cookie_notice": return ["topbar","headline","cookie_notice","cta"];
    case "native_ad": return ["topbar","headline","author_byline","media","intro","story","what_is","benefits","proof","testimonials","cta","faq","comments"];
    case "story": return ["urgency_bar","topbar","headline","story","what_is","how_it_works","benefits","pros","testimonials","trust_badges","cta","faq","comments"];
    case "listicle": return ["urgency_bar","topbar","headline","media","intro","benefits","pros","proof","testimonials","trust_badges","cta","faq"];
    case "age_gate":
    case "gender_gate":
    case "country_gate":
    case "captcha_gate":
      return ["topbar","headline","cta"];
    case "coupon": return ["urgency_bar","topbar","headline","viewers_counter","coupon_widget","benefits","testimonials","cta"];
    case "countdown": return ["urgency_bar","topbar","headline","viewers_counter","countdown_timer","benefits","trust_badges","testimonials","cta"];
    default: return ["urgency_bar","topbar","headline","viewers_counter","rating","media","intro","what_is","how_it_works","benefits","pros","cons","for_whom","testimonials","trust_badges","cta","faq","comments"];
  }
}

// Maps HTML lang attribute to our language codes
function detectLangFromHtml(html: string): string {
  const m = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  if (!m) return "";
  const raw = m[1].toLowerCase().trim();
  if (raw.startsWith("pt")) return "pt-BR";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("it")) return "it";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("ar")) return "ar";
  if (raw.startsWith("hi")) return "hi";
  if (raw.startsWith("nl")) return "nl";
  if (raw.startsWith("pl")) return "pl";
  if (raw.startsWith("tr")) return "tr";
  return "";
}

type Extracted = {
  title: string; description: string;
  og_title: string; og_description: string; og_image: string;
  canonical: string; h1: string; h2: string[];
  price: string; text: string;
  theme_color: string; brand_color: string;
  detected_lang: string;
};

// Tenta extrair a cor primária/brand do site: theme-color, botões, links primários
function extractBrandColor(html: string): string {
  // theme-color meta (mais confiável)
  const tc = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "")
    || (html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i)?.[1] ?? "");
  if (tc && /^#[0-9a-f]{3,6}$/i.test(tc)) return tc;
  // CSS custom property --primary ou --brand
  const varMatch = html.match(/--(?:primary|brand|color-primary|main-color)\s*:\s*(#[0-9a-f]{3,6})/i);
  if (varMatch) return varMatch[1];
  // Cor mais frequente em backgrounds de botões
  const bgColors = [...html.matchAll(/background(?:-color)?\s*:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
  if (bgColors.length) {
    const freq: Record<string, number> = {};
    for (const c of bgColors) { freq[c] = (freq[c] ?? 0) + 1; }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top && top !== "#ffffff" && top !== "#000000" && top !== "#f9f9f9" && top !== "#eeeeee") return top;
  }
  return "";
}

// Gera uma cor de acento levemente mais clara/saturada a partir da cor primária
function deriveAccent(hex: string): string {
  if (!hex || !/^#[0-9a-f]{3,6}$/i.test(hex)) return "#06b6d4";
  // simples: shift hue +30 graus (approx via lighten)
  return hex; // retorna a mesma por enquanto — o CSS aplica opacidade
}

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
  const brand_color = extractBrandColor(html);
  const theme_color = brand_color;
  const detected_lang = detectLangFromHtml(html);
  return { title, description, og_title, og_description, og_image, canonical, h1, h2, price, text, theme_color, brand_color, detected_lang };
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

function buildBlocks(
  p: any, type: string, affUrl: string, productImage: string, disclosure: string,
  siteTheme?: { primary: string; accent: string }, waPhone = "", waMessage = "",
  pixels: { facebook: string; google: string } = { facebook: "", google: "" },
  ctaDelay = 0,
) {
  const theme = siteTheme
    ? { primary: siteTheme.primary, accent: siteTheme.accent, bg: "#ffffff", text: "#0f172a" }
    : { ...DEFAULT_THEME };
  const isGate = GATE_TYPES.includes(type);
  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  return {
    type, affiliate_url: affUrl,
    order: defaultOrderFor(type),
    disclosure_text: disclosure,
    theme,
    pixels,
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
        visible: type === "bridge" || type === "cookie_notice" || GATE_TYPES.includes(type),
        text: p.cookie_notice ?? "Ao clicar você será redirecionado para o site oficial.",
      },
      cta: {
        visible: true,
        text: p.cta_text ?? "Acessar site oficial",
        note: p.cta_note ?? "Você será redirecionado para o site oficial do produto.",
        sticky: !GATE_TYPES.includes(type),
        reveal_after_seconds: type === "vsl" ? ctaDelay : 0,
      },
      faq: { visible: (p.faq ?? []).length > 0, title: "Perguntas frequentes", items: p.faq ?? [] },
      countdown_timer: {
        visible: type === "countdown",
        minutes: typeof p.countdown_minutes === "number" ? p.countdown_minutes : 15,
        message: p.urgency_message ?? "⏰ Oferta por tempo limitado!",
      },
      coupon_widget: {
        visible: type === "coupon",
        code: p.coupon_code ?? "PROMO10",
        discount_pct: p.discount_pct ?? "10% de desconto",
        expires_minutes: typeof p.countdown_minutes === "number" ? p.countdown_minutes : 20,
      },
      whatsapp_button: {
        visible: !!waPhone,
        phone: waPhone,
        message: waMessage || "Olá! Tenho interesse neste produto.",
        color: "#25d366",
      },
      urgency_bar: {
        visible: !isGate && type !== "bridge_story" && !!p.urgency_bar,
        text: p.urgency_bar ?? "🔥 Atenção: condição especial disponível por tempo limitado",
      },
      viewers_counter: {
        visible: !isGate && !["cookie_notice", "bridge", "bridge_story"].includes(type),
        min: 34, max: 97,
      },
      testimonials: {
        visible: (p.testimonials ?? []).length > 0,
        title: "O que estão dizendo",
        items: (p.testimonials ?? []).map((t: any) => ({
          name: String(t?.name ?? ""), text: String(t?.text ?? ""),
          stars: Math.min(5, Math.max(3, Number(t?.stars) || 5)),
        })),
      },
      comments: {
        visible: (p.comments ?? []).length > 0,
        title: "Comentários",
        items: (p.comments ?? []).map((c: any) => ({
          name: String(c?.name ?? ""), text: String(c?.text ?? ""),
          likes: Math.max(0, Number(c?.likes) || 0), time: String(c?.time ?? ""),
        })),
      },
      author_byline: {
        visible: ["advertorial", "native_ad"].includes(type),
        name: p.author_name ?? "Redação",
        role: p.author_role ?? "Equipe editorial",
        date: today,
      },
    },
  };
}

// ─────────────────────────────────────────────
// Gate type: simple AI prompt (headline only)
// ─────────────────────────────────────────────
function buildGatePrompt(type: string, niche: string, target_audience: string, language: string, ctx: string): string {
  const gateDesc: Record<string, string> = {
    age_gate: "verificação de idade (o usuário confirma ter 18+ anos antes de ser redirecionado)",
    gender_gate: "seleção de gênero (botões Masculino / Feminino — ambos levam ao link de afiliado)",
    country_gate: "seleção de país (grid de bandeiras — todas levam ao link de afiliado)",
    captcha_gate: "verificação de segurança estilo CAPTCHA (o usuário clica 'Não sou robô' para continuar)",
  };
  return `Crie uma headline curta e persuasiva para uma presell do tipo "${gateDesc[type] ?? type}".
Nicho: ${niche || "(não informado)"}
Público-alvo: ${target_audience || "(não informado)"}
Idioma: ${language || "pt-BR"}

${ctx}

Retorne APENAS este JSON (sem texto extra, sem markdown):
{
 "headline": "headline impactante de 6-10 palavras",
 "subheadline": "frase complementar de 10-15 palavras",
 "cta_text": "texto do botão de 3-6 palavras",
 "cookie_notice": "texto explicando o redirecionamento de forma transparente (1 frase)"
}`;
}

function buildCouponPrompt(niche: string, target_audience: string, language: string, ctx: string): string {
  return `Crie conteúdo para uma presell de CUPOM DE DESCONTO no nicho "${niche || "(não informado)"}".
Público-alvo: ${target_audience || "(não informado)"}
Idioma: ${language || "pt-BR"}

${ctx}

Retorne APENAS este JSON (sem texto extra, sem markdown):
{
 "topbar": "barra superior",
 "headline": "headline urgente destacando o desconto (8-12 palavras)",
 "subheadline": "explica o desconto disponível (10-15 palavras)",
 "coupon_code": "código ex: PROMO20 ou DESCONTO15 (criativo, relevante ao nicho)",
 "discount_pct": "ex: 20% de desconto",
 "countdown_minutes": 25,
 "benefits": ["benefício 1","benefício 2","benefício 3","benefício 4","benefício 5"],
 "cta_text": "texto do botão ex: Copiar cupom e acessar",
 "cta_note": "nota curta sobre o redirecionamento"
}`;
}

function buildCountdownPrompt(niche: string, target_audience: string, language: string, ctx: string): string {
  return `Crie conteúdo URGENTE para uma presell com TIMER COUNTDOWN no nicho "${niche || "(não informado)"}".
Público-alvo: ${target_audience || "(não informado)"}
Idioma: ${language || "pt-BR"}

${ctx}

Regras: a headline DEVE criar urgência máxima. Benefits devem ser específicos e persuasivos.

Retorne APENAS este JSON (sem texto extra, sem markdown):
{
 "topbar": "barra superior",
 "headline": "headline de urgência extrema (8-12 palavras, mencione escassez ou prazo)",
 "subheadline": "complementa urgência (10-15 palavras)",
 "countdown_minutes": 15,
 "urgency_message": "mensagem de urgência curta ex: ⏰ Oferta expira em breve!",
 "benefits": ["benefício 1","benefício 2","benefício 3","benefício 4","benefício 5"],
 "trust_badges": ["selo 1","selo 2","selo 3"],
 "cta_text": "texto do botão urgente",
 "cta_note": "nota curta"
}`;
}

async function processBg(opts: {
  admin: ReturnType<typeof createClient>; presellId: string;
  source_url: string; affiliate_url: string; presell_type: string;
  niche: string; target_audience: string; tone: string; language: string;
  extra_prompt: string; manual_info: string;
  whatsapp_phone: string; whatsapp_message: string;
  pixels: { facebook: string; google: string };
  cta_delay: number;
}) {
  const { admin, presellId, source_url, affiliate_url, presell_type,
    niche, target_audience, tone, extra_prompt, manual_info,
    whatsapp_phone, whatsapp_message, pixels, cta_delay } = opts;
  let language = opts.language;
  try {
    const fetched = source_url ? await fetchSource(source_url) : { ok: false as const, reason: "Sem URL" };
    const info: Extracted | null = fetched.ok ? fetched.data : null;
    const fetchError = fetched.ok ? null : fetched.reason;
    const productImage = info?.og_image ?? "";
    // Auto-detect language from producer page when user selected "auto"
    if (language === "auto" && info?.detected_lang) {
      language = info.detected_lang;
    } else if (language === "auto") {
      language = "pt-BR"; // fallback
    }

    const ctx = `Página oficial: ${source_url || "(não informada)"}
${info ? `Dados extraídos:
- Título: ${info.title}
- Descrição: ${info.description}
- OG Title: ${info.og_title}
- OG Description: ${info.og_description}
- H1: ${info.h1}
- H2s: ${info.h2.join(" | ")}
- Preço visível: ${info.price}
- Trecho: ${info.text.slice(0, 1000)}` : `Não foi possível ler a página${fetchError ? ` (${fetchError})` : ""}.`}
${manual_info ? `\nInformações do usuário:\n${manual_info}` : ""}
Comando extra: ${extra_prompt || "(nenhum)"}`;

    let raw: string;
    let p: any;

    if (GATE_TYPES.includes(presell_type)) {
      // Gate types: simple prompt
      raw = await chatCompletion([
        { role: "system", content: "Você é copywriter especializado em presells para afiliados. Responda APENAS com JSON válido, sem markdown, sem cercas de código, sem texto fora do JSON." },
        { role: "user", content: buildGatePrompt(presell_type, niche, target_audience, language, ctx) },
      ], 600);
    } else if (presell_type === "coupon") {
      raw = await chatCompletion([
        { role: "system", content: "Você é copywriter especializado em presells para afiliados. Responda APENAS com JSON válido, sem markdown, sem cercas de código, sem texto fora do JSON." },
        { role: "user", content: buildCouponPrompt(niche, target_audience, language, ctx) },
      ], 1000);
    } else if (presell_type === "countdown") {
      raw = await chatCompletion([
        { role: "system", content: "Você é copywriter especializado em presells para afiliados. Responda APENAS com JSON válido, sem markdown, sem cercas de código, sem texto fora do JSON." },
        { role: "user", content: buildCountdownPrompt(niche, target_audience, language, ctx) },
      ], 1000);
    } else {
      // Full content types (review, advertorial, quiz, etc.)
      const typeGuidance: Record<string, string> = {
        review: "Review detalhada e honesta. Use rating (0-5), pros e cons reais, FAQs técnicas. Tom: equilibrado e confiável.",
        advertorial: "Matéria editorial jornalística. 'topbar' como nome de publicação. Tom: editorial, informativo.",
        quiz: "3-5 perguntas com 4 opções cada que levem ao produto como solução. Resultado positivo no final.",
        comparativo: "Tabela comparativa com 5-8 features reais vs alternativas. Produto como vencedor claro.",
        bridge: "Direto e minimalista. 3-5 benefícios + cookie_notice transparente.",
        bridge_story: "Página ponte NARRATIVA e ÉTICA (sem dark patterns, sem pressão artificial). 'story' = hook + descoberta em primeira pessoa; 'how_it_works' = transição suave apresentando o produto sem hype; 'benefits' = 2-3 benefícios reais. CTA honesto que diz exatamente o que faz. Tom: autêntico e conversacional.",
        vsl: "Copy para vídeo de vendas. Suspense na headline. video_url vazio (usuário preencherá).",
        cookie_notice: "Ultra direto. Headline + aviso de redirecionamento + CTA. Nada mais.",
        native_ad: "Artigo patrocinado. 'topbar' = 'Conteúdo Patrocinado'. Tom jornalístico. 'story' = artigo fluido.",
        story: "Narrativa pessoal de transformação. 'story' = 300+ palavras contando problema, descoberta e transformação.",
        listicle: "Formato 'Top [N] razões por que...'. 'benefits' numerados com título curto + 2-3 linhas cada.",
      };
      const guidance = typeGuidance[presell_type] ?? typeGuidance.review;

      raw = await chatCompletion([
        { role: "system", content: "Você é um copywriter de alta conversão especializado em presells éticas para afiliados brasileiros. REGRA DE OURO DA PRESELL: NUNCA venda direto — aqueça o leitor, crie desejo e curiosidade, e faça o clique para a página do produtor parecer decisão do próprio leitor. Escreva conteúdo ORIGINAL, rico e persuasivo. Use parágrafos separados por \\n\\n nos campos de texto longo. NUNCA copie literalmente textos da página oficial. Responda APENAS com JSON válido, sem markdown, sem cercas de código (```), sem texto fora do JSON." },
        { role: "user", content: `Crie uma presell profissional (tipo "${presell_type}") com base no contexto abaixo.

INSTRUÇÕES ESPECÍFICAS:
${guidance}

CONTEXTO:
Nicho: ${niche}
Público-alvo: ${target_audience}
Tom: ${tone || "persuasivo"}
Idioma: ${language || "pt-BR"}
${ctx}

REGRAS DE QUALIDADE:
- headline: mínimo 8 palavras, desperta curiosidade (não vende — gera vontade de ler)
- subheadline: mínimo 10 palavras, detalha benefício
- intro: 2 parágrafos ricos separados por \\n\\n (mínimo 80 palavras)
- what_is: 2-3 parágrafos (mínimo 100 palavras)
- story: narrativa com 3-4 parágrafos (mínimo 150 palavras)
- benefits: mínimo 5 itens específicos
- pros: mínimo 3 itens
- cons: 1-2 itens honestos
- faq: mínimo 4 pares q/a
- testimonials: EXATAMENTE 3 depoimentos coerentes com o nicho, nomes brasileiros comuns (serão exibidos com aviso de conteúdo ilustrativo)
- comments: 4 a 6 comentários curtos estilo rede social, nomes brasileiros, tom espontâneo (com pequenas variações de escrita), likes entre 2 e 40, time tipo "2 h", "5 h", "1 d"
- urgency_bar: frase curta de urgência ética para a barra do topo (sem prazos falsos)
- author_name/author_role: autor fictício GENÉRICO para matéria (ex: "Carla M.", "Redação Saúde em Foco") — nunca use nome de pessoa real
${presell_type === "quiz" ? `- quiz: 3 a 5 perguntas de segmentação/engajamento com 3-4 opções cada (toda opção leva adiante) + result: recomendação final que aponta o produto como solução` : ""}
${presell_type === "bridge_story" ? `- REGRAS ESPECÍFICAS DO BRIDGE STORY (obrigatórias, têm prioridade sobre as regras gerais acima):
  - story: 3-4 parágrafos em primeira pessoa — (1) hook narrativo com uma situação/dor REAL do público-alvo, sem clickbait agressivo nem drama exagerado; (2) contexto de como "eu" cheguei até a solução (a descoberta), criando identificação genuína
  - how_it_works: a transição suave — apresenta o produto de forma natural ("foi aí que conheci..."), 1-2 parágrafos, sem hype exagerado
  - benefits: EXATAMENTE 2-3 benefícios reais e plausíveis do produto (proibido: promessas milagrosas, curas garantidas, resultados irreais ou com prazo inventado)
  - cta_text: honesto e específico sobre a ação (ex: "Quero conhecer o método") — NUNCA disfarçado de outra coisa ("continuar", "aceitar", "fechar aviso")
  - cta_note: deixa claro que o botão leva ao site oficial do produto e que o link pode ser de afiliado
  - topbar: rótulo de transparência curto, ex: "Conteúdo de parceiro · pode conter links de afiliado"
  - urgency_bar: retorne string vazia "" (este formato NÃO usa urgência)
  - headline: curiosidade honesta em tom de história pessoal, sem sensacionalismo
  - PROIBIDO em qualquer campo: urgência falsa, escassez inventada, prazos fictícios, imitar a página oficial do produtor` : ""}
${presell_type === "comparativo" ? `- comparison: 5 a 8 linhas comparando o produto vs alternativa genérica, com winner destacado` : ""}
- Dentro de strings use \\n para quebra de linha (nunca newline literal)

Retorne APENAS o JSON:
{
 "topbar": string,
 "headline": string,
 "subheadline": string,
 "rating": number,
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
 "comparison": ${presell_type === "comparativo" ? `{"product_a": string, "product_b": string, "rows": [{"feature": string, "a": string, "b": string}], "winner": string}` : "null"},
 "quiz": ${presell_type === "quiz" ? `{"title": string, "questions": [{"question": string, "options": string[]}], "result": string}` : "null"},
 "video_title": string,
 "video_url": "",
 "cookie_notice": string,
 "cta_text": string,
 "cta_note": string,
 "faq": [{"q":string,"a":string}],
 "testimonials": [{"name": string, "text": string, "stars": number}],
 "comments": [{"name": string, "text": string, "likes": number, "time": string}],
 "urgency_bar": string,
 "author_name": string,
 "author_role": string
}` },
      ], 4500);
    }

    if (!raw) throw new Error("Resposta vazia da IA");
    p = safeJsonParse(raw);

    // Usa cores do site oficial se extraídas
    const siteTheme = info?.brand_color
      ? { primary: info.brand_color, accent: info.brand_color }
      : undefined;

    const blocks = buildBlocks(p, presell_type, affiliate_url, productImage, DEFAULT_DISCLOSURE, siteTheme, whatsapp_phone, whatsapp_message, pixels, cta_delay);
    // Página oficial do produto: menção complementar na presell (o CTA principal segue sendo o link de afiliado)
    (blocks as any).official_url = source_url || "";
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
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY ausente" }, 500);
    // Aceita qualquer provedor de IA configurado
    if (!lovableKey && !geminiKey && !openaiKey) {
      return json({ error: "Configure GEMINI_API_KEY (gratuito), LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    }
    const supabase = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const testMode = body.test_mode === true;
    let { source_url = "", affiliate_url = "", presell_type = "review",
      niche = "", target_audience = "", tone = "", language = "auto",
      extra_prompt = "", manual_info = "" } = body;
    const whatsapp_phone = String(body.whatsapp_phone ?? "").replace(/\D/g, "");
    const whatsapp_message = String(body.whatsapp_message ?? "");
    const pixels = {
      facebook: String(body.fb_pixel_id ?? "").replace(/[^A-Za-z0-9_-]/g, ""),
      google: String(body.google_tag_id ?? "").replace(/[^A-Za-z0-9_-]/g, ""),
    };
    const cta_delay = Math.min(600, Math.max(0, Number(body.cta_delay_seconds) || 0));

    if (testMode) {
      affiliate_url = String(affiliate_url || "https://exemplo.com/afiliado").trim();
      source_url = String(source_url || "").trim();
    } else {
      affiliate_url = String(affiliate_url || "").trim();
      if (!affiliate_url) return json({ error: "Informe o link de afiliado" }, 400);
      if (!isValidUrl(affiliate_url)) return json({ error: "Link de afiliado inválido. Use http(s)://" }, 400);
      if (source_url && !isValidUrl(source_url)) return json({ error: "Link da página oficial inválido" }, 400);
    }
    if (!VALID_TYPES.includes(presell_type)) presell_type = "review";

    const hostBase = source_url ? (() => { try { return new URL(source_url).hostname.replace(/^www\./, ""); } catch { return ""; } })() : "";
    const base = slugify(`${hostBase || niche || presell_type}-${presell_type}`);
    let slug = base, n = 0;
    while (true) {
      const { data: ex } = await admin.from("presells").select("id").eq("slug", slug).maybeSingle();
      if (!ex) break;
      n++; slug = `${base}-${n}`;
    }

    if (testMode) {
      const mockP = {
        topbar: "Análise Independente | Conteúdo Informativo",
        headline: `Review Completo: ${niche || "Produto"} — Vale a Pena?`,
        subheadline: `Analisamos em detalhes para que você tome a melhor decisão`,
        rating: 4.7, rating_label: "Nota geral",
        intro: `Nesta análise completa de ${niche || "este produto"}, vamos mostrar tudo que você precisa saber antes de decidir.\n\n[MODO MOCK — gerado sem IA para teste]`,
        what_is: `${niche || "Este produto"} é uma solução desenvolvida para ${target_audience || "pessoas que querem resultados"}.`,
        story: `Eu já tinha tentado de tudo em ${niche || "minha rotina"} e nada parecia funcionar de verdade.\n\nFoi pesquisando por conta própria que encontrei uma abordagem diferente — e resolvi testar sem grandes expectativas.\n\n[MODO MOCK — narrativa de exemplo gerada sem IA]`,
        how_it_works: `Foi aí que conheci ${niche || "esta solução"}. Sem fórmula mágica: um método simples, aplicado com constância, que fez diferença no meu dia a dia.`,
        for_whom: ["Iniciantes que querem começar do zero", "Quem já tentou outras soluções", "Pessoas que buscam resultados"],
        benefits: ["Resultados em menos de 30 dias", "Suporte 24/7", "Método passo a passo", "Acesso vitalício"],
        pros: ["Fácil de usar", "Suporte rápido", "Garantia de 30 dias"],
        cons: ["Requer dedicação", "Resultados variam"],
        proof: ["Mais de 10.000 clientes", "Metodologia validada"],
        trust_badges: ["Compra 100% segura", "Garantia de 30 dias", "Suporte especializado"],
        faq: [
          { q: "Para quem é?", a: `Para ${target_audience || "qualquer pessoa"} que quer resultados reais.` },
          { q: "Tem garantia?", a: "Sim, 30 dias de garantia incondicional." },
          { q: "Como acesso?", a: "Por e-mail em até 5 minutos após a compra." },
        ],
        cta_text: "Acessar site oficial",
        cta_note: "Você será redirecionado para o site oficial do produto.",
        coupon_code: "PROMO20",
        discount_pct: "20% de desconto",
        countdown_minutes: 15,
        urgency_message: "⏰ Oferta por tempo limitado!",
        urgency_bar: "🔥 Atenção: condição especial disponível hoje",
        testimonials: [
          { name: "Mariana L.", text: "Comecei sem esperar muito e me surpreendi com o resultado.", stars: 5 },
          { name: "Rafael S.", text: "Valeu cada centavo. O suporte respondeu rápido.", stars: 5 },
          { name: "Juliana P.", text: "Achei o método simples de seguir no dia a dia.", stars: 4 },
        ],
        comments: [
          { name: "Camila Rodrigues", text: "Alguém já testou? To quase pedindo", likes: 12, time: "2 h" },
          { name: "Pedro Henrique", text: "comprei semana passada, chegou certinho", likes: 8, time: "5 h" },
          { name: "Fernanda Alves", text: "O desconto ainda tá valendo?", likes: 3, time: "1 d" },
          { name: "Lucas M.", text: "Recomendo, só compra no site oficial pra ter garantia", likes: 21, time: "1 d" },
        ],
        author_name: "Redação",
        author_role: "Equipe editorial",
        quiz: presell_type === "quiz" ? {
          title: "Descubra a melhor opção para você",
          questions: [
            { question: "Qual é o seu maior objetivo hoje?", options: ["Resultados rápidos", "Resultado duradouro", "Só estou pesquisando"] },
            { question: "Você já tentou outras soluções?", options: ["Sim, várias", "Uma ou duas", "Nunca tentei"] },
            { question: "Quanto tempo por dia você teria disponível?", options: ["Menos de 15 min", "30 min", "1 hora ou mais"] },
          ],
          result: "Com base nas suas respostas, a solução mais indicada para o seu perfil é a oficial abaixo.",
        } : null,
        comparison: presell_type === "comparativo" ? {
          product_a: "Produto Oficial", product_b: "Alternativa genérica",
          rows: [
            { feature: "Garantia", a: "30 dias", b: "Sem garantia" },
            { feature: "Suporte", a: "Oficial", b: "Inexistente" },
            { feature: "Preço", a: "Promocional", b: "Variável" },
          ],
          winner: "Produto Oficial",
        } : null,
      };
      const blocks = buildBlocks(mockP, presell_type, affiliate_url, "", DEFAULT_DISCLOSURE, undefined, whatsapp_phone, whatsapp_message, pixels, cta_delay);
      (blocks as any).official_url = source_url || "";
      const title = mockP.headline;
      const { data: created, error: insErr } = await admin.from("presells").insert({
        user_id: userId, title, slug, source_url, affiliate_url, presell_type, tone, language,
        status: "completed", is_published: true, blocks, disclosure_text: DEFAULT_DISCLOSURE,
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      return json({ presellId: created.id, slug, status: "completed", test_mode: true }, 201);
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
      admin, presellId: created.id,
      source_url, affiliate_url, presell_type, niche, target_audience, tone, language,
      extra_prompt, manual_info, whatsapp_phone, whatsapp_message, pixels, cta_delay,
    }));

    return json({ presellId: created.id, slug, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
