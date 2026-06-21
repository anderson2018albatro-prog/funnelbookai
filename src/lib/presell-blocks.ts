// Presell / Bridge page blocks: types and HTML renderer.
// Ethical presells only: NO cookie stuffing, NO invisible redirects.
// All affiliate clicks require an explicit user click on a CTA.

export type PresellType =
  | "review"
  | "advertorial"
  | "quiz"
  | "comparativo"
  | "bridge"
  | "vsl"
  | "cookie_notice";

export type PresellBlockKey =
  | "headline"
  | "media"
  | "intro"
  | "what_is"
  | "for_whom"
  | "benefits"
  | "pros"
  | "cons"
  | "story"
  | "how_it_works"
  | "proof"
  | "comparison"
  | "quiz"
  | "video"
  | "cookie_notice"
  | "cta";

export type PresellBlocks = {
  type: PresellType;
  order: PresellBlockKey[];
  affiliate_url: string;
  data: {
    headline: { visible: boolean; title: string; subtitle: string };
    media: { visible: boolean; image_url: string };
    intro: { visible: boolean; text: string };
    what_is: { visible: boolean; title: string; text: string };
    for_whom: { visible: boolean; title: string; items: string[] };
    benefits: { visible: boolean; title: string; items: string[] };
    pros: { visible: boolean; title: string; items: string[] };
    cons: { visible: boolean; title: string; items: string[] };
    story: { visible: boolean; title: string; text: string };
    how_it_works: { visible: boolean; title: string; text: string };
    proof: { visible: boolean; title: string; items: string[] };
    comparison: {
      visible: boolean;
      title: string;
      product_a: string;
      product_b: string;
      rows: { feature: string; a: string; b: string }[];
      winner: string;
    };
    quiz: {
      visible: boolean;
      title: string;
      questions: { question: string; options: string[] }[];
      result: string;
    };
    video: { visible: boolean; title: string; video_url: string };
    cookie_notice: { visible: boolean; text: string };
    cta: { visible: boolean; text: string; note: string };
  };
};

export const PRESELL_LABELS: Record<PresellBlockKey, string> = {
  headline: "Headline",
  media: "Imagem",
  intro: "Introdução",
  what_is: "O que é o produto",
  for_whom: "Para quem é",
  benefits: "Benefícios",
  pros: "Pontos positivos",
  cons: "Pontos de atenção",
  story: "História / problema",
  how_it_works: "Como funciona",
  proof: "Prova / argumentos",
  comparison: "Comparativo",
  quiz: "Quiz",
  video: "Vídeo",
  cookie_notice: "Aviso de cookies / redirecionamento",
  cta: "Botão CTA",
};

export const PRESELL_TYPE_LABELS: Record<PresellType, string> = {
  review: "Review / Análise",
  advertorial: "Advertorial (matéria)",
  quiz: "Quiz Presell",
  comparativo: "Comparativo",
  bridge: "Bridge Page simples",
  vsl: "VSL Presell",
  cookie_notice: "Página com aviso de cookies",
};

export function defaultOrderFor(type: PresellType): PresellBlockKey[] {
  switch (type) {
    case "review":
      return ["headline", "media", "intro", "what_is", "for_whom", "benefits", "pros", "cons", "cta"];
    case "advertorial":
      return ["headline", "media", "story", "what_is", "how_it_works", "benefits", "proof", "cta"];
    case "quiz":
      return ["headline", "quiz", "cta"];
    case "comparativo":
      return ["headline", "comparison", "benefits", "cta"];
    case "bridge":
      return ["headline", "benefits", "cookie_notice", "cta"];
    case "vsl":
      return ["headline", "video", "benefits", "cta"];
    case "cookie_notice":
      return ["headline", "cookie_notice", "cta"];
  }
}

export function emptyPresell(type: PresellType, affiliateUrl: string): PresellBlocks {
  return {
    type,
    order: defaultOrderFor(type),
    affiliate_url: affiliateUrl || "#",
    data: {
      headline: { visible: true, title: "", subtitle: "" },
      media: { visible: false, image_url: "" },
      intro: { visible: true, text: "" },
      what_is: { visible: true, title: "O que é", text: "" },
      for_whom: { visible: true, title: "Para quem é", items: [] },
      benefits: { visible: true, title: "Benefícios", items: [] },
      pros: { visible: true, title: "Pontos positivos", items: [] },
      cons: { visible: true, title: "Pontos de atenção", items: [] },
      story: { visible: true, title: "História", text: "" },
      how_it_works: { visible: true, title: "Como funciona", text: "" },
      proof: { visible: true, title: "Provas", items: [] },
      comparison: { visible: true, title: "Comparativo", product_a: "Produto A", product_b: "Produto B", rows: [], winner: "" },
      quiz: { visible: true, title: "Descubra a solução ideal", questions: [], result: "" },
      video: { visible: true, title: "Assista ao vídeo", video_url: "" },
      cookie_notice: {
        visible: true,
        text: "Aviso: ao clicar no botão você será redirecionado para o site oficial do produto. Nenhum cookie de afiliado é definido até você clicar.",
      },
      cta: { visible: true, text: "Acessar site oficial", note: "Você será redirecionado para a página oficial do produto." },
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

export function renderPresellHtml(blocks: PresellBlocks, fallbackTitle: string): string {
  const d = blocks.data;
  const aff = blocks.affiliate_url || "#";
  const order = blocks.order ?? defaultOrderFor(blocks.type);
  const sec: string[] = [];

  // CTA anchor (rel="sponsored nofollow noopener" — ethical affiliate link)
  const ctaButton = (label: string) =>
    `<a class="cta" href="${esc(aff)}" target="_blank" rel="sponsored nofollow noopener">${esc(label)}</a>`;

  for (const key of order) {
    const b: any = (d as any)[key];
    if (!b || b.visible === false) continue;
    switch (key) {
      case "headline":
        sec.push(`<header class="hero">
  <h1>${esc(b.title)}</h1>
  ${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ""}
</header>`);
        break;
      case "media":
        if (b.image_url)
          sec.push(`<section class="wrap"><img class="media" src="${esc(b.image_url)}" alt="${esc(fallbackTitle)}" /></section>`);
        break;
      case "intro":
        if (b.text) sec.push(`<section class="wrap"><p class="lead">${esc(b.text)}</p></section>`);
        break;
      case "what_is":
      case "story":
      case "how_it_works":
        if (b.text) sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></section>`);
        break;
      case "for_whom":
      case "benefits":
      case "pros":
      case "cons":
      case "proof":
        if (b.items?.length)
          sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><ul class="feat">${ul(b.items)}</ul></section>`);
        break;
      case "comparison": {
        const rows = (b.rows || []).map(
          (r: any) => `<tr><td>${esc(r.feature)}</td><td>${esc(r.a)}</td><td>${esc(r.b)}</td></tr>`).join("");
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2>
  <table class="cmp"><thead><tr><th></th><th>${esc(b.product_a)}</th><th>${esc(b.product_b)}</th></tr></thead>
  <tbody>${rows}</tbody></table>
  ${b.winner ? `<p class="winner"><strong>Melhor opção:</strong> ${esc(b.winner)}</p>` : ""}
  </section>`);
        break;
      }
      case "quiz": {
        const qs = (b.questions || []).map((q: any, i: number) =>
          `<div class="q"><h3>${i + 1}. ${esc(q.question)}</h3><ul>${(q.options || []).map((o: string) => `<li>${esc(o)}</li>`).join("")}</ul></div>`).join("");
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2>${qs}
  ${b.result ? `<div class="result"><strong>Recomendação:</strong> ${esc(b.result)}</div>` : ""}</section>`);
        break;
      }
      case "video": {
        const em = embedUrl(b.video_url);
        if (em) sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><div class="video"><iframe src="${esc(em)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div></section>`);
        break;
      }
      case "cookie_notice":
        if (b.text) sec.push(`<section class="wrap"><div class="notice">${esc(b.text)}</div></section>`);
        break;
      case "cta":
        sec.push(`<section class="wrap final" id="cta-final">
  ${ctaButton(b.text || "Acessar site oficial")}
  ${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}
</section>`);
        break;
    }
  }

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(d.headline?.title || fallbackTitle)}</title>
<meta name="description" content="${esc(d.headline?.subtitle || "")}" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;background:#fff}
.wrap{max-width:780px;margin:0 auto;padding:32px 16px}
.hero{background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;padding:56px 16px;text-align:center}
.hero h1{font-size:clamp(26px,4.5vw,44px);font-weight:800;max-width:780px;margin:0 auto}
.hero p{font-size:clamp(15px,2.2vw,19px);opacity:.95;margin-top:14px}
h2{font-size:clamp(20px,2.6vw,28px);margin-bottom:14px}
.lead{font-size:18px;color:#334155}
.media{max-width:100%;border-radius:14px;display:block;margin:0 auto;box-shadow:0 8px 24px rgba(0,0,0,.12)}
ul.feat{list-style:none;display:grid;gap:10px}
ul.feat li{background:#f1f5f9;padding:12px 16px;border-radius:10px;border-left:4px solid #6366f1}
.cmp{width:100%;border-collapse:collapse;margin-top:8px}
.cmp th,.cmp td{padding:10px;border:1px solid #e2e8f0;text-align:left}
.cmp th{background:#f8fafc}
.winner{margin-top:12px}
.q{background:#f8fafc;padding:14px;border-radius:10px;margin-bottom:10px}
.q ul{margin-top:6px;padding-left:18px}
.result{background:#ecfdf5;border:1px solid #10b981;padding:14px;border-radius:10px;margin-top:10px}
.video{width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.video iframe{width:100%;height:100%;border:0}
.notice{background:#fef3c7;border:1px solid #f59e0b;color:#78350f;padding:14px 16px;border-radius:10px;font-size:14px}
.final{text-align:center}
.cta{display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:700;padding:16px 36px;border-radius:12px;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.note{margin-top:14px;color:#64748b;font-size:13px}
footer{padding:24px;text-align:center;color:#64748b;font-size:12px}
</style></head>
<body>
${sec.join("\n")}
<footer>Esta é uma página de recomendação. Ao clicar no botão você é redirecionado para o site oficial do produto. Podemos receber comissão por compras realizadas.</footer>
</body></html>`;
}
