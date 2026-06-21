// Shared types/render for sales page blocks. Used by editor and edge function (logic mirrored).

export type BlockKey =
  | "hero"
  | "product"
  | "promessa"
  | "beneficios"
  | "para_quem"
  | "aprendizado"
  | "bonus"
  | "depoimentos"
  | "oferta"
  | "garantia"
  | "faq"
  | "final_cta";

export type BlockMap = {
  hero: { visible: boolean; headline: string; subheadline: string; cta_text: string };
  product: { visible: boolean; image_url: string; video_url: string };
  promessa: { visible: boolean; title: string; text: string };
  beneficios: { visible: boolean; title: string; items: string[] };
  para_quem: { visible: boolean; title: string; items: string[] };
  aprendizado: { visible: boolean; title: string; items: string[] };
  bonus: { visible: boolean; title: string; items: string[] };
  depoimentos: { visible: boolean; title: string; items: { name: string; text: string }[] };
  oferta: { visible: boolean; title: string; description: string; price: string; cta_text: string; cta_url: string };
  garantia: { visible: boolean; title: string; text: string };
  faq: { visible: boolean; title: string; items: { pergunta: string; resposta: string }[] };
  final_cta: { visible: boolean; headline: string; cta_text: string; cta_url: string };
};

export type SalesBlocks = {
  order: BlockKey[];
  data: BlockMap;
};

export const DEFAULT_ORDER: BlockKey[] = [
  "hero",
  "product",
  "promessa",
  "beneficios",
  "para_quem",
  "aprendizado",
  "bonus",
  "depoimentos",
  "oferta",
  "garantia",
  "faq",
  "final_cta",
];

export const BLOCK_LABELS: Record<BlockKey, string> = {
  hero: "Hero / Headline",
  product: "Imagem ou vídeo do produto",
  promessa: "Promessa principal",
  beneficios: "Benefícios",
  para_quem: "Para quem é",
  aprendizado: "O que vai aprender",
  bonus: "Bônus",
  depoimentos: "Depoimentos",
  oferta: "Oferta / preço",
  garantia: "Garantia",
  faq: "FAQ",
  final_cta: "Botão de compra final",
};

export function buildBlocksFromAI(sp: any, fallbackTitle: string): SalesBlocks {
  return {
    order: DEFAULT_ORDER,
    data: {
      hero: {
        visible: true,
        headline: sp.headline ?? fallbackTitle,
        subheadline: sp.subheadline ?? "",
        cta_text: sp.cta ?? "Quero agora",
      },
      product: { visible: false, image_url: "", video_url: "" },
      promessa: { visible: true, title: "A grande promessa", text: sp.promessa_principal ?? "" },
      beneficios: { visible: true, title: "Benefícios", items: sp.beneficios ?? [] },
      para_quem: { visible: true, title: "Para quem é", items: sp.para_quem ?? [] },
      aprendizado: { visible: true, title: "O que você vai aprender", items: sp.aprendizado ?? [] },
      bonus: { visible: (sp.bonus ?? []).length > 0, title: "🎁 Bônus exclusivos", items: sp.bonus ?? [] },
      depoimentos: { visible: false, title: "O que dizem", items: [] },
      oferta: {
        visible: true,
        title: "Oferta especial",
        description: sp.oferta ?? "",
        price: "",
        cta_text: sp.cta ?? "Quero agora",
        cta_url: "#",
      },
      garantia: { visible: !!sp.garantia, title: "✅ Garantia", text: sp.garantia ?? "" },
      faq: { visible: (sp.faq ?? []).length > 0, title: "Perguntas frequentes", items: sp.faq ?? [] },
      final_cta: {
        visible: true,
        headline: sp.headline ?? fallbackTitle,
        cta_text: sp.cta ?? "Garantir o meu agora",
        cta_url: "#",
      },
    },
  };
}

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function embedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.replace("/", "")}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* noop */ }
  return null;
}

const ul = (items: string[]) => items.filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("");

export function renderBlocksToHtml(blocks: SalesBlocks, fallbackTitle: string): string {
  const d = blocks.data;
  const order = blocks.order ?? DEFAULT_ORDER;
  const sec: string[] = [];

  for (const key of order) {
    const b: any = (d as any)[key];
    if (!b || b.visible === false) continue;

    switch (key) {
      case "hero":
        sec.push(`<header class="hero">
  <h1>${esc(b.headline)}</h1>
  ${b.subheadline ? `<p>${esc(b.subheadline)}</p>` : ""}
  <a class="cta" href="#oferta">${esc(b.cta_text || "Quero agora")}</a>
</header>`);
        break;
      case "product": {
        const embed = embedUrl(b.video_url);
        if (!b.image_url && !embed) break;
        sec.push(`<section class="wrap product">
  ${embed ? `<div class="video"><iframe src="${esc(embed)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>` : ""}
  ${b.image_url ? `<img src="${esc(b.image_url)}" alt="${esc(fallbackTitle)}" />` : ""}
</section>`);
        break;
      }
      case "promessa":
        if (!b.text) break;
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><div class="promise">${esc(b.text)}</div></section>`);
        break;
      case "beneficios":
      case "para_quem":
      case "aprendizado":
        if (!(b.items?.length)) break;
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><ul class="feat">${ul(b.items)}</ul></section>`);
        break;
      case "bonus":
        if (!(b.items?.length)) break;
        sec.push(`<section class="wrap"><div class="bonus"><h3>${esc(b.title)}</h3><ul>${ul(b.items)}</ul></div></section>`);
        break;
      case "depoimentos":
        if (!(b.items?.length)) break;
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><div class="testis">${b.items
          .map((t: any) => `<blockquote><p>"${esc(t.text)}"</p><cite>— ${esc(t.name)}</cite></blockquote>`)
          .join("")}</div></section>`);
        break;
      case "oferta":
        sec.push(`<section class="wrap" id="oferta"><h2>${esc(b.title)}</h2>
  <div class="offer">
    ${b.description ? `<p style="font-size:20px;margin-bottom:16px">${esc(b.description)}</p>` : ""}
    ${b.price ? `<div class="price">${esc(b.price)}</div>` : ""}
    <a class="cta" href="${esc(b.cta_url || "#cta-final")}">${esc(b.cta_text || "Quero agora")}</a>
  </div>
</section>`);
        break;
      case "garantia":
        if (!b.text) break;
        sec.push(`<section class="wrap"><div class="guarantee"><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div></section>`);
        break;
      case "faq":
        if (!(b.items?.length)) break;
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2>${b.items
          .map((f: any) => `<details><summary>${esc(f.pergunta)}</summary><p>${esc(f.resposta)}</p></details>`)
          .join("")}</section>`);
        break;
      case "final_cta":
        sec.push(`<section class="final" id="cta-final">
  <h2>${esc(b.headline)}</h2>
  <a class="cta" href="${esc(b.cta_url || "#")}">${esc(b.cta_text || "Garantir agora")}</a>
</section>`);
        break;
    }
  }

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(d.hero?.headline || fallbackTitle)}</title>
<meta name="description" content="${esc(d.hero?.subheadline || "")}" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;background:#fff}
.wrap{max-width:880px;margin:0 auto;padding:24px 16px}
.hero{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:64px 16px;text-align:center}
.hero h1{font-size:clamp(28px,5vw,52px);font-weight:800;line-height:1.15;max-width:880px;margin:0 auto}
.hero p{font-size:clamp(16px,2.4vw,20px);opacity:.95;max-width:720px;margin:18px auto 0}
.cta{display:inline-block;background:#fff;color:#6366f1;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;margin-top:28px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
.product{display:grid;gap:16px;justify-items:center}
.product img{max-width:100%;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.15)}
.video{width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.15)}
.video iframe{width:100%;height:100%;border:0}
section{padding:48px 0;border-bottom:1px solid #e5e7eb}
h2{font-size:clamp(22px,3vw,32px);margin-bottom:20px;text-align:center}
.promise{background:#f8fafc;padding:32px;border-radius:16px;text-align:center;font-size:18px;font-weight:500}
ul.feat{list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
ul.feat li{background:#f1f5f9;padding:16px 20px;border-radius:12px;border-left:4px solid #6366f1}
.offer{background:linear-gradient(135deg,#f5f3ff,#ede9fe);padding:40px;border-radius:20px;text-align:center}
.price{font-size:32px;font-weight:800;color:#6366f1;margin:12px 0}
.bonus{background:#fef3c7;padding:24px;border-radius:14px}
.bonus h3{margin-bottom:12px;color:#92400e}
.bonus ul{padding-left:20px}
.guarantee{background:#ecfdf5;border:2px solid #10b981;padding:28px;border-radius:16px;text-align:center}
.guarantee h3{color:#065f46;margin-bottom:10px}
.testis{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.testis blockquote{background:#f8fafc;padding:20px;border-radius:12px;border-left:4px solid #8b5cf6}
.testis cite{display:block;margin-top:10px;font-weight:600;color:#64748b;font-style:normal}
details{background:#f8fafc;padding:16px 20px;border-radius:10px;margin-bottom:10px;cursor:pointer}
details summary{font-weight:600;list-style:none}
.final{background:#0f172a;color:#fff;padding:64px 16px;text-align:center}
.final h2{color:#fff}
.final .cta{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
footer{padding:24px;text-align:center;color:#64748b;font-size:13px}
</style></head>
<body>
${sec.join("\n")}
<footer>Criado com FunnelBook AI</footer>
</body></html>`;
}
