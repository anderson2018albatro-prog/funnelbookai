// Presell / Bridge page blocks: types and HTML renderer.
// Ethical only: NO cookie stuffing, NO invisible redirects, NO auto-fired affiliate links.
// Every CTA is a real anchor with target="_blank" rel="sponsored noopener noreferrer".

export type PresellType =
  | "review" | "advertorial" | "quiz" | "comparativo" | "bridge" | "vsl" | "cookie_notice"
  | "native_ad" | "story" | "listicle";

export type PresellBlockKey =
  | "topbar" | "headline" | "rating" | "media" | "intro" | "what_is" | "for_whom"
  | "benefits" | "pros" | "cons" | "story" | "how_it_works" | "proof" | "trust_badges"
  | "comparison" | "quiz" | "video" | "cookie_notice" | "cta" | "faq";

export type PresellTheme = {
  primary: string;        // hex, e.g. #6366f1
  accent: string;
  bg: string;
  text: string;
};

export type PresellBlocks = {
  type: PresellType;
  order: PresellBlockKey[];
  affiliate_url: string;
  disclosure_text: string;
  theme: PresellTheme;
  data: {
    topbar: { visible: boolean; text: string };
    headline: { visible: boolean; title: string; subtitle: string };
    rating: { visible: boolean; stars: number; label: string };
    media: { visible: boolean; image_url: string; caption: string };
    intro: { visible: boolean; text: string };
    what_is: { visible: boolean; title: string; text: string };
    for_whom: { visible: boolean; title: string; items: string[] };
    benefits: { visible: boolean; title: string; items: string[] };
    pros: { visible: boolean; title: string; items: string[] };
    cons: { visible: boolean; title: string; items: string[] };
    story: { visible: boolean; title: string; text: string };
    how_it_works: { visible: boolean; title: string; text: string };
    proof: { visible: boolean; title: string; items: string[] };
    trust_badges: { visible: boolean; items: string[] };
    comparison: {
      visible: boolean; title: string;
      product_a: string; product_b: string;
      rows: { feature: string; a: string; b: string }[];
      winner: string;
    };
    quiz: {
      visible: boolean; title: string;
      questions: { question: string; options: string[] }[];
      result: string;
    };
    video: { visible: boolean; title: string; video_url: string };
    cookie_notice: { visible: boolean; text: string };
    cta: { visible: boolean; text: string; note: string; sticky: boolean };
    faq: { visible: boolean; title: string; items: { q: string; a: string }[] };
  };
};

export const PRESELL_LABELS: Record<PresellBlockKey, string> = {
  topbar: "Barra superior",
  headline: "Headline",
  rating: "Avaliação / nota",
  media: "Imagem do produto",
  intro: "Introdução",
  what_is: "O que é o produto",
  for_whom: "Para quem é",
  benefits: "Benefícios",
  pros: "Pontos positivos",
  cons: "Pontos de atenção",
  story: "História / problema",
  how_it_works: "Como funciona",
  proof: "Prova / argumentos",
  trust_badges: "Selos de confiança",
  comparison: "Comparativo",
  quiz: "Quiz",
  video: "Vídeo",
  cookie_notice: "Aviso de redirecionamento",
  cta: "Botão CTA",
  faq: "FAQ",
};

export const PRESELL_TYPE_LABELS: Record<PresellType, string> = {
  review: "Review Premium",
  advertorial: "Advertorial (matéria editorial)",
  quiz: "Quiz Presell",
  comparativo: "Comparativo de produtos",
  bridge: "Bridge Page direta",
  vsl: "VSL Presell (vídeo)",
  cookie_notice: "Aviso de redirecionamento",
  native_ad: "Anúncio Nativo (artigo patrocinado)",
  story: "Narrativa de Transformação",
  listicle: "Listicle (Top Razões)",
};

export const DEFAULT_THEME: PresellTheme = {
  primary: "#6366f1",
  accent: "#06b6d4",
  bg: "#ffffff",
  text: "#0f172a",
};

export const DEFAULT_DISCLOSURE =
  "Esta página pode conter links de afiliado. Podemos receber comissão por compras realizadas, sem custo adicional para você.";

export function defaultOrderFor(type: PresellType): PresellBlockKey[] {
  switch (type) {
    case "review":
      return ["topbar","headline","rating","media","intro","what_is","how_it_works","benefits","pros","cons","for_whom","trust_badges","cta","faq"];
    case "advertorial":
      return ["topbar","headline","media","story","what_is","how_it_works","benefits","proof","cta","faq"];
    case "quiz":
      return ["topbar","headline","quiz","cta"];
    case "comparativo":
      return ["topbar","headline","comparison","benefits","cta","faq"];
    case "bridge":
      return ["topbar","headline","benefits","cookie_notice","cta"];
    case "vsl":
      return ["topbar","headline","video","benefits","cta","faq"];
    case "cookie_notice":
      return ["topbar","headline","cookie_notice","cta"];
    case "native_ad":
      return ["topbar","headline","media","intro","story","what_is","benefits","proof","cta","faq"];
    case "story":
      return ["topbar","headline","story","what_is","how_it_works","benefits","pros","trust_badges","cta","faq"];
    case "listicle":
      return ["topbar","headline","media","intro","benefits","pros","proof","trust_badges","cta","faq"];
  }
}

export function emptyPresell(type: PresellType, affiliateUrl: string): PresellBlocks {
  return {
    type,
    order: defaultOrderFor(type),
    affiliate_url: affiliateUrl || "#",
    disclosure_text: DEFAULT_DISCLOSURE,
    theme: { ...DEFAULT_THEME },
    data: {
      topbar: { visible: true, text: "Análise independente" },
      headline: { visible: true, title: "", subtitle: "" },
      rating: { visible: type === "review", stars: 4.7, label: "Nota geral" },
      media: { visible: false, image_url: "", caption: "" },
      intro: { visible: true, text: "" },
      what_is: { visible: true, title: "O que é", text: "" },
      for_whom: { visible: true, title: "Para quem é", items: [] },
      benefits: { visible: true, title: "Benefícios", items: [] },
      pros: { visible: true, title: "Pontos positivos", items: [] },
      cons: { visible: true, title: "Pontos de atenção", items: [] },
      story: { visible: true, title: "A história", text: "" },
      how_it_works: { visible: true, title: "Como funciona", text: "" },
      proof: { visible: true, title: "Provas / argumentos", items: [] },
      trust_badges: { visible: false, items: ["Compra 100% segura", "Garantia oficial", "Suporte do fabricante"] },
      comparison: { visible: true, title: "Comparativo", product_a: "Oficial", product_b: "Alternativa", rows: [], winner: "" },
      quiz: { visible: true, title: "Descubra a melhor opção", questions: [], result: "" },
      video: { visible: true, title: "Assista", video_url: "" },
      cookie_notice: {
        visible: true,
        text: "Ao clicar no botão você será redirecionado para o site oficial do produto. Nenhum cookie é definido antes do seu clique.",
      },
      cta: { visible: true, text: "Acessar site oficial", note: "Você será redirecionado para o site oficial do produto.", sticky: true },
      faq: { visible: true, title: "Perguntas frequentes", items: [] },
    },
  };
}

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function embedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.replace("/", "")}`;
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* noop */ }
  return null;
}

const ul = (items: string[]) =>
  (items || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("");

function starsHtml(score: number): string {
  const full = Math.floor(score);
  const half = score - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "☆" : "") + "✩".repeat(empty);
}

export function isValidAffiliateUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

function typeStyles(type: PresellType): string {
  switch (type) {
    case "advertorial":
      return `
body{font-family:'Georgia','Times New Roman',serif;background:#fafaf9}
.topbar{background:#1e293b;font-family:Georgia,serif;font-size:12px;letter-spacing:2.5px}
.hero{background:#1e293b;padding:52px 20px}
.hero::before{background:none}
.band.alt{background:#f5f5f0}
h2{font-family:Georgia,serif;font-style:italic;letter-spacing:0}
.prose,.lead{font-family:Georgia,serif;font-size:17px;line-height:1.85}
.lead{font-size:21px;font-style:italic}
.cards li{background:#f5f5f0;border-left-color:#1e293b}
.cards li::before{background:#1e293b}
footer.aff-footer{background:#1e293b;color:#94a3b8;border-top-color:#374151}
footer.aff-footer .disclosure{color:#94a3b8}`;
    case "review":
      return `
.hero{background:linear-gradient(135deg,#1e293b,#334155)}
.topbar{background:#1e293b;letter-spacing:1px}
.rating{background:#fff;border-radius:24px;box-shadow:0 8px 32px rgba(0,0,0,.1);padding:28px;max-width:340px;margin:0 auto}
.stars{color:#f59e0b;font-size:38px;letter-spacing:6px}
.rscore{font-size:36px;font-weight:800;color:#1e293b}
.pros li{background:#ecfdf5;border-color:#10b981;color:#065f46}
.cons li{background:#fffbeb;border-color:#f59e0b;color:#92400e}
.cards li{border-left-color:#f59e0b}
.cards li::before{background:#f59e0b}`;
    case "quiz":
      return `
.hero{background:linear-gradient(135deg,#7c3aed,#6d28d9)}
.topbar{background:#6d28d9}
.q{border:2px solid #ede9fe;border-radius:18px;padding:24px;transition:border-color .2s,box-shadow .2s}
.q:hover{border-color:#7c3aed;box-shadow:0 4px 16px rgba(124,58,237,.15)}
.q h3{color:#4c1d95;font-size:17px}
.q ul{list-style:none;display:grid;gap:8px;margin-top:0}
.q ul li{background:#f5f3ff;padding:12px 16px;border-radius:10px;border-left:3px solid #7c3aed;font-size:15px}
.result{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;padding:20px 24px;font-size:17px}
.cta,.cta-large{background:linear-gradient(135deg,#7c3aed,#f59e0b)}
.cards li::before{background:#7c3aed}
.cards li{border-left-color:#7c3aed}`;
    case "comparativo":
      return `
.hero{background:linear-gradient(135deg,#0ea5e9,#0284c7)}
.topbar{background:#0369a1}
.cmp th:nth-child(2){background:#dcfce7;color:#166534;font-size:15px}
.cmp td:nth-child(2){font-weight:700;color:#166534}
.winner{background:#dcfce7;border:2px solid #86efac;border-radius:14px;padding:16px 20px;font-size:18px;font-weight:700;color:#166534;text-align:center;margin-top:16px}
.cards li::before{background:#0ea5e9}
.cards li{border-left-color:#0ea5e9}
.cta,.cta-large{background:linear-gradient(135deg,#0ea5e9,#10b981)}`;
    case "vsl":
      return `
*{color:inherit}
body{background:#0a0f1e;color:#e2e8f0}
.topbar{background:#1e1b4b;color:#a5b4fc}
.hero{background:linear-gradient(135deg,#1e1b4b,#0a0f1e);padding:80px 20px}
.hero .sub{color:#cbd5e1}
.band{background:#111827;border-bottom:1px solid #1f2937}
.band.alt{background:#0f172a}
h2{color:#f1f5f9}
.prose{color:#94a3b8}
.lead{color:#cbd5e1;font-size:20px}
.cards li{background:#1f2937;border-color:#374151;color:#e2e8f0;border-left-color:#e11d48}
.cards li::before{background:#e11d48}
.pros li{background:#1f2937;border-color:#10b981;color:#6ee7b7}
.cons li{background:#1f2937;border-color:#f59e0b;color:#fcd34d}
.faq{background:#1f2937;border-color:#374151}
.faq summary{color:#f1f5f9}
.faq p{color:#94a3b8}
.video{box-shadow:0 20px 60px rgba(225,29,72,.3)}
.cta,.cta-large{background:linear-gradient(135deg,#e11d48,#f59e0b)}
.sticky-cta{background:rgba(10,15,30,.96);border-top-color:#374151}
footer.aff-footer{background:#060a14;border-top-color:#1f2937}`;
    case "bridge":
    case "cookie_notice":
      return `
body{background:#f8fafc}
.hero{background:linear-gradient(135deg,#6366f1,#4f46e5);padding:52px 20px}
.notice{font-size:15px;border:2px solid #bfdbfe;background:#eff6ff;border-radius:16px;padding:22px;color:#1e40af;max-width:680px;margin:0 auto}
.finalcta{padding:48px 0}
.cta-large{font-size:20px;padding:22px 56px;border-radius:18px;box-shadow:0 16px 40px rgba(99,102,241,.4)}
.band{background:#fff}
.band.alt{background:#f1f5f9}`;
    case "native_ad":
      return `
body{font-family:'Georgia','Times New Roman',serif;background:#fff}
.topbar{background:#e63946;color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700}
.hero{background:#fff;color:#111;padding:44px 20px;border-bottom:3px solid #e63946}
.hero h1{font-family:Georgia,serif;color:#111;font-size:clamp(26px,4.5vw,44px);line-height:1.2}
.hero .sub{color:#555;font-family:Georgia,serif;font-style:italic;margin:12px auto 0;font-size:18px}
.hero .cta{display:none}
.hero::before{background:none}
.band.alt{background:#f5f5f0}
h2{font-family:Georgia,serif;font-style:italic;text-align:left;border-bottom:1px solid #ddd;padding-bottom:10px}
.prose,.lead{font-family:Georgia,serif;font-size:18px;line-height:1.85;color:#222}
.cards li{border-left-color:#e63946;background:#fff8f8}
.cards li::before{background:#e63946}
.cta,.cta-large{background:#e63946;box-shadow:0 8px 24px rgba(230,57,70,.3)}
.cta:hover,.cta-large:hover{box-shadow:0 12px 32px rgba(230,57,70,.45)}`;
    case "story":
      return `
.hero{background:linear-gradient(160deg,#1e1b4b,#312e81);padding:72px 20px}
.topbar{background:#312e81}
.band.alt{background:#faf9ff}
.prose{font-size:17px;line-height:1.9;color:#1e1b4b}
.lead{font-size:21px;color:#312e81;font-style:italic;font-weight:600}
h2{color:#1e1b4b}
.cards li{border-left-color:#7c3aed;background:#f5f3ff}
.cards li::before{background:#7c3aed}
.pros li{background:#ecfdf5;border-color:#10b981;color:#065f46}
.cta,.cta-large{background:linear-gradient(135deg,#7c3aed,#e11d48);box-shadow:0 10px 30px rgba(124,58,237,.35)}`;
    case "listicle":
      return `
.hero{background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:72px 20px}
.topbar{background:#1e3a5f;letter-spacing:1px}
.band.alt{background:#f8fafc}
.cards{grid-template-columns:1fr}
.cards li{border-left:none;border-top:4px solid var(--p);padding-left:20px;counter-increment:item;display:grid;grid-template-columns:40px 1fr;align-items:start;gap:12px}
.cards li::before{content:counter(item);width:36px;height:36px;font-size:16px;font-weight:800;background:linear-gradient(135deg,#0ea5e9,#6366f1)}
.cards{counter-reset:item}
.pros{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.pros li{border-color:#0ea5e9;background:#eff6ff;color:#1e40af}
.cta,.cta-large{background:linear-gradient(135deg,#0ea5e9,#6366f1);box-shadow:0 10px 30px rgba(14,165,233,.35)}
h2{text-align:left;border-bottom:3px solid var(--p);padding-bottom:10px;display:inline-block}`;
    default:
      return "";
  }
}

export function renderPresellHtml(blocks: PresellBlocks, fallbackTitle: string): string {
  const d = blocks.data;
  const aff = blocks.affiliate_url || "#";
  const theme = blocks.theme ?? DEFAULT_THEME;
  const order = blocks.order ?? defaultOrderFor(blocks.type);
  const disclosure = blocks.disclosure_text || DEFAULT_DISCLOSURE;
  const sec: string[] = [];

  // Every CTA: real anchor, opens in new tab, rel="sponsored noopener noreferrer". data-cta marks it for click tracking.
  const ctaButton = (label: string, variant: "primary" | "large" = "primary") =>
    `<a class="cta cta-${variant}" data-cta="1" href="${esc(aff)}" target="_blank" rel="sponsored noopener noreferrer">${esc(label)} <span aria-hidden="true">→</span></a>`;

  let altBg = false;
  const section = (inner: string, opts: { wrap?: boolean; hero?: boolean; padded?: boolean } = {}) => {
    if (opts.hero) return `<header class="hero">${inner}</header>`;
    const bg = altBg ? "alt" : "";
    altBg = !altBg;
    return `<section class="band ${bg}"><div class="${opts.wrap === false ? "" : "wrap"}">${inner}</div></section>`;
  };

  for (const key of order) {
    const b: any = (d as any)[key];
    if (!b || b.visible === false) continue;
    switch (key) {
      case "topbar":
        if (b.text) sec.push(`<div class="topbar">${esc(b.text)}</div>`);
        break;
      case "headline":
        sec.push(section(
          `<h1>${esc(b.title || fallbackTitle)}</h1>${b.subtitle ? `<p class="sub">${esc(b.subtitle)}</p>` : ""}
${ctaButton(d.cta.text || "Ver oferta oficial", "large")}`,
          { hero: true }
        ));
        break;
      case "rating":
        sec.push(section(
          `<div class="rating"><div class="stars">${starsHtml(b.stars || 0)}</div><div class="rscore">${(b.stars || 0).toFixed(1)} / 5</div><div class="rlabel">${esc(b.label || "")}</div></div>`
        ));
        break;
      case "media":
        if (b.image_url)
          sec.push(section(
            `<figure class="figure"><img class="media" src="${esc(b.image_url)}" alt="${esc(fallbackTitle)}" loading="lazy" />${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`
          ));
        break;
      case "intro":
        if (b.text) sec.push(section(`<p class="lead">${esc(b.text)}</p>`));
        break;
      case "what_is":
      case "story":
      case "how_it_works":
        if (b.text)
          sec.push(section(`<h2>${esc(b.title)}</h2><p class="prose">${esc(b.text)}</p>`));
        break;
      case "for_whom":
      case "benefits":
      case "proof":
        if (b.items?.length)
          sec.push(section(`<h2>${esc(b.title)}</h2><ul class="cards">${ul(b.items)}</ul>`));
        break;
      case "pros":
        if (b.items?.length)
          sec.push(section(`<h2>${esc(b.title)}</h2><ul class="pros">${ul(b.items)}</ul>`));
        break;
      case "cons":
        if (b.items?.length)
          sec.push(section(`<h2>${esc(b.title)}</h2><ul class="cons">${ul(b.items)}</ul>`));
        break;
      case "trust_badges":
        if (b.items?.length)
          sec.push(section(
            `<div class="badges">${b.items.map((x: string) => `<span class="badge">✓ ${esc(x)}</span>`).join("")}</div>`
          ));
        break;
      case "comparison": {
        const rows = (b.rows || []).map(
          (r: any) => `<tr><td>${esc(r.feature)}</td><td>${esc(r.a)}</td><td>${esc(r.b)}</td></tr>`).join("");
        sec.push(section(
          `<h2>${esc(b.title)}</h2>
<div class="tablewrap"><table class="cmp"><thead><tr><th></th><th>${esc(b.product_a)}</th><th>${esc(b.product_b)}</th></tr></thead><tbody>${rows}</tbody></table></div>
${b.winner ? `<p class="winner"><strong>Recomendado:</strong> ${esc(b.winner)}</p>` : ""}`
        ));
        break;
      }
      case "quiz": {
        const qs = (b.questions || []).map((q: any, i: number) =>
          `<div class="q"><h3>${i + 1}. ${esc(q.question)}</h3><ul>${(q.options || []).map((o: string) => `<li>${esc(o)}</li>`).join("")}</ul></div>`).join("");
        sec.push(section(
          `<h2>${esc(b.title)}</h2>${qs}${b.result ? `<div class="result"><strong>Recomendação:</strong> ${esc(b.result)}</div>` : ""}`
        ));
        break;
      }
      case "video": {
        const em = embedUrl(b.video_url);
        if (em) sec.push(section(
          `<h2>${esc(b.title)}</h2><div class="video"><iframe src="${esc(em)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
        ));
        break;
      }
      case "cookie_notice":
        if (b.text) sec.push(section(`<div class="notice">${esc(b.text)}</div>`));
        break;
      case "faq":
        if (b.items?.length) sec.push(section(
          `<h2>${esc(b.title)}</h2>${b.items.map((it: any) =>
            `<details class="faq"><summary>${esc(it.q)}</summary><p>${esc(it.a)}</p></details>`).join("")}`
        ));
        break;
      case "cta":
        sec.push(section(
          `<div class="finalcta">${ctaButton(b.text || "Acessar site oficial", "large")}${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}</div>`
        ));
        break;
    }
  }

  const stickyCta = d.cta.sticky !== false
    ? `<div class="sticky-cta"><a class="cta cta-sticky" data-cta="1" href="${esc(aff)}" target="_blank" rel="sponsored noopener noreferrer">${esc(d.cta.text || "Acessar site oficial")}</a></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(d.headline?.title || fallbackTitle)}</title>
<meta name="description" content="${esc(d.headline?.subtitle || "")}" />
<meta name="robots" content="index,follow" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --p:${theme.primary};--a:${theme.accent};--bg:${theme.bg};--fg:${theme.text};
  --muted:#64748b;--surface:#f8fafc;--surface2:#f1f5f9;--border:#e2e8f0;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.65;color:var(--fg);background:var(--bg);padding-bottom:88px}
img{max-width:100%;display:block}
.topbar{background:var(--fg);color:#fff;text-align:center;font-size:13px;padding:8px 16px;letter-spacing:.3px;text-transform:uppercase;font-weight:600}
.hero{background:linear-gradient(135deg,var(--p),var(--a));color:#fff;padding:64px 20px 72px;text-align:center;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,.15),transparent 50%);pointer-events:none}
.hero h1{font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(30px,5.5vw,52px);font-weight:800;line-height:1.15;max-width:820px;margin:0 auto;letter-spacing:-.02em}
.hero .sub{font-size:clamp(16px,2.4vw,20px);opacity:.95;margin:18px auto 0;max-width:680px}
.band{padding:48px 20px}
.band.alt{background:var(--surface)}
.wrap{max-width:880px;margin:0 auto}
h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(24px,3.4vw,34px);margin-bottom:22px;letter-spacing:-.015em;line-height:1.2}
.prose{font-size:17px;color:#334155;max-width:760px}
.lead{font-size:20px;color:#334155;font-weight:500;text-align:center;max-width:720px;margin:0 auto}
.figure{margin:0 auto;max-width:560px;text-align:center}
.media{border-radius:18px;box-shadow:0 12px 40px rgba(15,23,42,.12);margin:0 auto}
figcaption{margin-top:10px;font-size:13px;color:var(--muted)}
.rating{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px}
.stars{font-size:32px;color:#f59e0b;letter-spacing:4px}
.rscore{font-size:22px;font-weight:700}
.rlabel{color:var(--muted);font-size:14px}
.cards{list-style:none;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.cards li{background:#fff;border:1px solid var(--border);padding:18px 20px;border-radius:14px;font-weight:500;position:relative;padding-left:48px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.cards li::before{content:"✓";position:absolute;left:16px;top:18px;width:24px;height:24px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.pros,.cons{list-style:none;display:grid;gap:10px}
.pros li,.cons li{background:#fff;border-left:4px solid;padding:14px 18px;border-radius:10px;font-weight:500}
.pros li{border-color:#10b981;background:#ecfdf5}
.cons li{border-color:#f59e0b;background:#fffbeb}
.badges{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.badge{background:#fff;border:1px solid var(--border);padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600;color:#0f172a}
.tablewrap{overflow-x:auto}
.cmp{width:100%;border-collapse:collapse;min-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid var(--border)}
.cmp th,.cmp td{padding:14px 16px;border-bottom:1px solid var(--border);text-align:left}
.cmp th{background:var(--surface2);font-weight:700;color:#0f172a}
.cmp td:first-child{font-weight:600}
.winner{margin-top:14px;font-size:16px;color:#065f46}
.q{background:#fff;border:1px solid var(--border);padding:18px 20px;border-radius:12px;margin-bottom:12px}
.q ul{margin-top:10px;padding-left:22px;color:#334155}
.result{background:#ecfdf5;border:1px solid #10b981;padding:16px 18px;border-radius:12px;margin-top:14px;font-size:16px}
.video{width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.12);background:#000}
.video iframe{width:100%;height:100%;border:0}
.notice{background:#fef3c7;border:1px solid #f59e0b;color:#78350f;padding:16px 20px;border-radius:12px;font-size:15px;text-align:center;max-width:720px;margin:0 auto}
.faq{background:#fff;border:1px solid var(--border);padding:16px 20px;border-radius:12px;margin-bottom:10px;cursor:pointer}
.faq summary{font-weight:600;font-size:16px;list-style:none;display:flex;justify-content:space-between;align-items:center}
.faq summary::after{content:"+";font-size:22px;font-weight:300;color:var(--p)}
.faq[open] summary::after{content:"−"}
.faq p{margin-top:12px;color:#334155}
.finalcta{text-align:center;padding:20px 0}
.note{margin-top:14px;color:var(--muted);font-size:13px}
.cta{display:inline-block;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;font-weight:700;padding:18px 36px;border-radius:14px;text-decoration:none;box-shadow:0 10px 30px rgba(99,102,241,.35);transition:transform .15s ease, box-shadow .15s ease;font-size:17px}
.cta:hover{transform:translateY(-1px);box-shadow:0 14px 36px rgba(99,102,241,.45)}
.cta-large{padding:20px 44px;font-size:18px;margin-top:28px}
.hero .cta{background:#fff;color:var(--p)}
.hero .cta:hover{box-shadow:0 14px 36px rgba(0,0,0,.2)}
.sticky-cta{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--border);padding:12px 16px;z-index:50;display:flex;justify-content:center}
.sticky-cta .cta{width:100%;max-width:520px;text-align:center;padding:16px;border-radius:12px;font-size:16px}
@media (min-width:768px){.sticky-cta{display:none}body{padding-bottom:0}}
footer.aff-footer{padding:32px 20px 24px;text-align:center;color:var(--muted);font-size:12px;border-top:1px solid var(--border);background:var(--surface)}
footer.aff-footer .disclosure{max-width:720px;margin:0 auto 8px;font-size:13px}
${typeStyles(blocks.type)}
</style></head>
<body>
${sec.join("\n")}
<footer class="aff-footer">
<p class="disclosure">${esc(disclosure)}</p>
<p>© ${new Date().getFullYear()}. Conteúdo independente.</p>
</footer>
${stickyCta}
</body></html>`;
}
