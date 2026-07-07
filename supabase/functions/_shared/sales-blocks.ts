// Shared types/render for sales page blocks. Used by editor and edge function (logic mirrored).

export type BlockKey =
  | "hero"
  | "video_vsl"
  | "dor"
  | "mecanismo"
  | "product"
  | "promessa"
  | "beneficios"
  | "para_quem"
  | "aprendizado"
  | "stack"
  | "bonus"
  | "depoimentos"
  | "oferta"
  | "garantia"
  | "urgencia"
  | "faq"
  | "final_cta";

export type SalesTheme = "clean" | "dark" | "highconvert";

export type PageStructure = "vsl" | "carta" | "lancamento" | "low_ticket" | "high_ticket" | "assinatura";

export const STRUCTURE_LABELS: Record<PageStructure, string> = {
  vsl: "VSL Page (vídeo + bullets + oferta)",
  carta: "Carta de vendas longa (PAS completo)",
  lancamento: "Página de lançamento",
  low_ticket: "Low ticket (direto ao ponto)",
  high_ticket: "High ticket (autoridade + prova social)",
  assinatura: "Assinatura / recorrência",
};

export const THEME_LABELS: Record<SalesTheme, string> = {
  clean: "Clean branco",
  dark: "Dark premium",
  highconvert: "High-convert (vermelho/amarelo)",
};

export type BlockMap = {
  hero: { visible: boolean; headline: string; subheadline: string; cta_text: string };
  video_vsl: { visible: boolean; title: string; video_url: string; placeholder_text: string };
  dor: { visible: boolean; title: string; text: string };
  mecanismo: { visible: boolean; title: string; nome: string; text: string };
  product: { visible: boolean; image_url: string; video_url: string };
  promessa: { visible: boolean; title: string; text: string };
  beneficios: { visible: boolean; title: string; items: string[] };
  para_quem: { visible: boolean; title: string; items: string[] };
  aprendizado: { visible: boolean; title: string; items: string[] };
  stack: {
    visible: boolean; title: string;
    items: { item: string; valor: string }[];
    total_value: string; price: string; anchor_text: string;
    cta_text: string; cta_url: string;
  };
  bonus: { visible: boolean; title: string; items: string[] };
  depoimentos: { visible: boolean; title: string; items: { name: string; text: string; stars?: number; placeholder?: boolean; image_url?: string }[]; is_placeholder?: boolean };
  oferta: { visible: boolean; title: string; description: string; price: string; cta_text: string; cta_url: string };
  garantia: { visible: boolean; title: string; text: string; image_url?: string };
  urgencia: { visible: boolean; title: string; text: string };
  faq: { visible: boolean; title: string; items: { pergunta: string; resposta: string }[] };
  final_cta: { visible: boolean; headline: string; cta_text: string; cta_url: string };
};

export type SalesBlocks = {
  order: BlockKey[];
  data: BlockMap;
  theme?: SalesTheme;
  structure?: PageStructure;
};

export const DEFAULT_ORDER: BlockKey[] = [
  "hero",
  "video_vsl",
  "dor",
  "mecanismo",
  "product",
  "promessa",
  "beneficios",
  "para_quem",
  "aprendizado",
  "stack",
  "bonus",
  "depoimentos",
  "oferta",
  "garantia",
  "urgencia",
  "faq",
  "final_cta",
];

// A IA decide a MELHOR estrutura; cada estrutura tem sua ordem de blocos.
export function orderForStructure(s: PageStructure | undefined): BlockKey[] {
  switch (s) {
    case "vsl":
      return ["hero", "video_vsl", "beneficios", "depoimentos", "stack", "oferta", "garantia", "urgencia", "faq", "final_cta"];
    case "carta":
      return ["hero", "dor", "mecanismo", "promessa", "beneficios", "para_quem", "aprendizado", "depoimentos", "stack", "bonus", "oferta", "garantia", "urgencia", "faq", "final_cta"];
    case "lancamento":
      return ["hero", "video_vsl", "dor", "mecanismo", "beneficios", "aprendizado", "bonus", "depoimentos", "stack", "oferta", "garantia", "urgencia", "faq", "final_cta"];
    case "low_ticket":
      return ["hero", "promessa", "beneficios", "stack", "oferta", "garantia", "faq", "final_cta"];
    case "high_ticket":
      return ["hero", "dor", "mecanismo", "depoimentos", "para_quem", "beneficios", "aprendizado", "stack", "oferta", "garantia", "faq", "final_cta"];
    case "assinatura":
      return ["hero", "dor", "beneficios", "aprendizado", "stack", "depoimentos", "oferta", "garantia", "faq", "final_cta"];
    default:
      return DEFAULT_ORDER;
  }
}

export const BLOCK_LABELS: Record<BlockKey, string> = {
  hero: "Hero / Headline",
  video_vsl: "Vídeo VSL",
  dor: "Lead / Agitação da dor",
  mecanismo: "Mecanismo único",
  product: "Imagem ou vídeo do produto",
  promessa: "Promessa principal",
  beneficios: "Bullets de fascínio / Benefícios",
  para_quem: "Para quem é",
  aprendizado: "O que vai aprender",
  stack: "Stack da oferta (ancoragem)",
  bonus: "Bônus",
  depoimentos: "Depoimentos",
  oferta: "Oferta / preço",
  garantia: "Garantia",
  urgencia: "Escassez / Urgência",
  faq: "FAQ (quebra de objeções)",
  final_cta: "Botão de compra final",
};

export function buildBlocksFromAI(sp: any, fallbackTitle: string): SalesBlocks {
  const structure: PageStructure | undefined =
    ["vsl", "carta", "lancamento", "low_ticket", "high_ticket", "assinatura"].includes(sp.estrutura)
      ? sp.estrutura
      : undefined;
  const stackItems: { item: string; valor: string }[] = Array.isArray(sp.stack)
    ? sp.stack.map((s: any) => ({ item: String(s?.item ?? s ?? ""), valor: String(s?.valor ?? "") }))
    : [];
  const ctaUrl = sp.button_url || "#";
  return {
    order: orderForStructure(structure),
    structure,
    theme: (["clean", "dark", "highconvert"].includes(sp.theme) ? sp.theme : "clean") as SalesTheme,
    data: {
      hero: {
        visible: true,
        headline: sp.headline ?? fallbackTitle,
        subheadline: sp.subheadline ?? "",
        cta_text: sp.cta ?? "Quero agora",
      },
      video_vsl: {
        visible: structure === "vsl" || structure === "lancamento",
        title: sp.video_titulo ?? "Assista ao vídeo até o final",
        video_url: "",
        placeholder_text: "▶ Seu vídeo de vendas entra aqui — cole o link do YouTube/Vimeo no editor",
      },
      dor: { visible: !!sp.dor_lead, title: sp.dor_titulo ?? "Você se identifica com isso?", text: sp.dor_lead ?? "" },
      mecanismo: {
        visible: !!(sp.mecanismo?.nome || sp.mecanismo?.descricao),
        title: "O mecanismo por trás do resultado",
        nome: sp.mecanismo?.nome ?? "",
        text: sp.mecanismo?.descricao ?? "",
      },
      product: { visible: false, image_url: "", video_url: "" },
      promessa: { visible: !!sp.promessa_principal, title: "A grande promessa", text: sp.promessa_principal ?? "" },
      beneficios: { visible: true, title: sp.beneficios_titulo ?? "O que você vai destravar", items: sp.beneficios ?? [] },
      para_quem: { visible: (sp.para_quem ?? []).length > 0, title: "Para quem é", items: sp.para_quem ?? [] },
      aprendizado: { visible: (sp.aprendizado ?? []).length > 0, title: "O que você vai aprender", items: sp.aprendizado ?? [] },
      stack: {
        visible: stackItems.length > 0,
        title: "Tudo que você recebe hoje",
        items: stackItems,
        total_value: sp.valor_total ?? "",
        price: sp.price ?? "",
        anchor_text: sp.ancoragem ?? "",
        cta_text: sp.cta ?? "Quero garantir o meu",
        cta_url: ctaUrl,
      },
      bonus: { visible: (sp.bonus ?? []).length > 0, title: "🎁 Bônus exclusivos", items: sp.bonus ?? [] },
      depoimentos: { visible: false, title: "O que dizem", items: [] },
      oferta: {
        visible: true,
        title: "Oferta especial",
        description: sp.oferta ?? "",
        price: sp.price ?? "",
        cta_text: sp.cta ?? "Quero agora",
        cta_url: ctaUrl,
      },
      garantia: { visible: !!sp.garantia, title: "✅ Garantia incondicional", text: sp.garantia ?? "" },
      urgencia: { visible: !!sp.urgencia, title: "⏰ Atenção", text: sp.urgencia ?? "" },
      faq: { visible: (sp.faq ?? []).length > 0, title: "Perguntas frequentes", items: sp.faq ?? [] },
      final_cta: {
        visible: true,
        headline: sp.headline ?? fallbackTitle,
        cta_text: sp.cta ?? "Garantir o meu agora",
        cta_url: ctaUrl,
      },
    },
  };
}

// Garante que registros antigos (sem os blocos novos) funcionem no editor.
export function backfillBlocks(b: SalesBlocks): SalesBlocks {
  const empty = buildBlocksFromAI({}, "");
  const data: any = { ...b.data };
  for (const key of DEFAULT_ORDER) {
    if (!data[key]) data[key] = (empty.data as any)[key];
  }
  const order = [...(b.order ?? [])];
  for (const key of DEFAULT_ORDER) {
    if (!order.includes(key)) {
      // insere blocos novos ocultos no fim (antes do final_cta quando possível)
      const idx = order.indexOf("final_cta");
      if (idx >= 0) order.splice(idx, 0, key); else order.push(key);
    }
  }
  return { ...b, order, data, theme: b.theme ?? "clean" };
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

// CSS por tema visual. Todos mobile-first com CTAs grandes.
function themeCss(theme: SalesTheme): string {
  switch (theme) {
    case "dark":
      return `
:root{--p:#c9a227;--a:#e7c65a;--bg:#0b1020;--fg:#e8eaf2;--surface:#121936;--border:#232c54;--muted:#9aa3c0}
body{background:var(--bg);color:var(--fg)}
.hero{background:linear-gradient(160deg,#0b1020,#1a2350);border-bottom:1px solid var(--border)}
.hero h1{color:#fff}
.cta{background:linear-gradient(135deg,var(--p),var(--a));color:#191400;box-shadow:0 10px 34px rgba(201,162,39,.35)}
.hero .cta{background:linear-gradient(135deg,var(--p),var(--a));color:#191400}
section{border-bottom:1px solid var(--border)}
h2{color:#fff}
.promise{background:var(--surface);color:var(--fg)}
ul.feat li{background:var(--surface);border-left-color:var(--p);color:var(--fg)}
.testis blockquote{background:var(--surface);border-left-color:var(--p)}
.testis cite{color:var(--muted)}
.offer{background:linear-gradient(135deg,#141b3d,#1a2350);color:var(--fg)}
.price{color:var(--a)}
.bonus{background:#241d05}.bonus h3{color:var(--a)}.bonus ul{color:var(--fg)}
.guarantee{background:#0d2b22;border-color:#10b981}.guarantee h3{color:#34d399}.guarantee p{color:#d1fae5}
details{background:var(--surface);color:var(--fg)}
.final{background:#05070f}
.stackbox{background:var(--surface);border-color:var(--border)}
.stackbox li{border-bottom-color:var(--border)}
.dorbox{background:var(--surface);color:var(--fg)}
.mecabox{background:linear-gradient(135deg,#141b3d,#1a2350);border-color:var(--p)}
.urgbox{background:#2b1a05;border-color:var(--p);color:#fde68a}
.vslbox{background:#000;border:1px solid var(--border)}
footer{color:var(--muted)}`;
    case "highconvert":
      return `
:root{--p:#dc2626;--a:#facc15;--bg:#ffffff;--fg:#111827;--surface:#fef2f2;--border:#fecaca;--muted:#6b7280}
.hero{background:linear-gradient(135deg,#b91c1c,#dc2626)}
.cta{background:linear-gradient(135deg,#facc15,#f59e0b);color:#451a03;box-shadow:0 12px 34px rgba(220,38,38,.35);text-transform:uppercase;letter-spacing:.5px}
.hero .cta{background:linear-gradient(135deg,#facc15,#f59e0b);color:#451a03}
ul.feat li{border-left-color:#dc2626;background:#fef2f2}
.offer{background:linear-gradient(135deg,#fef2f2,#fee2e2)}
.price{color:#dc2626}
.final{background:#7f1d1d}
.final .cta{background:linear-gradient(135deg,#facc15,#f59e0b);color:#451a03}
.stackbox{border-color:#fecaca}
.mecabox{border-color:#dc2626;background:#fff7ed}
.urgbox{background:#fef9c3;border-color:#f59e0b;color:#713f12}
.testis blockquote{border-left-color:#dc2626}`;
    default: // clean
      return `
:root{--p:#6366f1;--a:#8b5cf6;--bg:#ffffff;--fg:#0f172a;--surface:#f8fafc;--border:#e5e7eb;--muted:#64748b}`;
  }
}

export function renderBlocksToHtml(blocks: SalesBlocks, fallbackTitle: string): string {
  const d = blocks.data;
  const order = blocks.order ?? DEFAULT_ORDER;
  const theme: SalesTheme = blocks.theme ?? "clean";
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
      case "video_vsl": {
        const embed = embedUrl(b.video_url);
        sec.push(`<section class="wrap"><h2>${esc(b.title || "Assista ao vídeo")}</h2>
  ${embed
    ? `<div class="video vslbox"><iframe src="${esc(embed)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
    : `<div class="vslbox vsl-placeholder"><div class="vsl-play">▶</div><p>${esc(b.placeholder_text || "Seu vídeo de vendas entra aqui")}</p></div>`}
</section>`);
        break;
      }
      case "dor":
        if (!b.text) break;
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><div class="dorbox">${String(b.text).split(/\n\n+/).map((p: string) => `<p>${esc(p)}</p>`).join("")}</div></section>`);
        break;
      case "mecanismo":
        if (!b.nome && !b.text) break;
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2>
  <div class="mecabox">
    ${b.nome ? `<div class="meca-nome">${esc(b.nome)}</div>` : ""}
    ${b.text ? String(b.text).split(/\n\n+/).map((p: string) => `<p>${esc(p)}</p>`).join("") : ""}
  </div>
</section>`);
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
      case "stack": {
        if (!(b.items?.length)) break;
        const rows = b.items
          .map((it: any) => `<li><span class="stack-item">✅ ${esc(it.item)}</span>${it.valor ? `<span class="stack-valor">${esc(it.valor)}</span>` : ""}</li>`)
          .join("");
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2>
  <div class="stackbox">
    <ul>${rows}</ul>
    ${b.total_value ? `<div class="stack-total">Valor total: <s>${esc(b.total_value)}</s></div>` : ""}
    ${b.anchor_text ? `<div class="stack-anchor">${esc(b.anchor_text)}</div>` : ""}
    ${b.price ? `<div class="price">${esc(b.price)}</div>` : ""}
    <a class="cta" href="${esc(b.cta_url || "#cta-final")}">${esc(b.cta_text || "Quero garantir o meu")}</a>
  </div>
</section>`);
        break;
      }
      case "bonus":
        if (!(b.items?.length)) break;
        sec.push(`<section class="wrap"><div class="bonus"><h3>${esc(b.title)}</h3><ul>${ul(b.items)}</ul></div></section>`);
        break;
      case "depoimentos":
        if (!(b.items?.length)) break;
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><div class="testis">${b.items
          .map((t: any) => `<blockquote>${t.image_url ? `<img class="t-img" src="${esc(t.image_url)}" alt="${esc(t.name || "depoimento")}" loading="lazy" />` : ""}${t.stars ? `<div class="t-stars">${"⭐".repeat(Math.min(5, t.stars))}</div>` : ""}${t.text ? `<p>"${esc(t.text)}"</p>` : ""}${t.name ? `<cite>— ${esc(t.name)}</cite>` : ""}</blockquote>`)
          .join("")}</div>${b.is_placeholder ? `<p class="placeholder-notice">⚠️ Depoimentos de exemplo — substitua pelos reais antes de publicar.</p>` : ""}</section>`);
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
        sec.push(`<section class="wrap"><div class="guarantee">${b.image_url ? `<img class="g-img" src="${esc(b.image_url)}" alt="selo de garantia" loading="lazy" />` : ""}<h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div></section>`);
        break;
      case "urgencia":
        if (!b.text) break;
        sec.push(`<section class="wrap"><div class="urgbox"><strong>${esc(b.title)}</strong><p>${esc(b.text)}</p></div></section>`);
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
:root{--p:#6366f1;--a:#8b5cf6;--bg:#ffffff;--fg:#0f172a;--surface:#f8fafc;--border:#e5e7eb;--muted:#64748b}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:var(--fg);background:var(--bg)}
.wrap{max-width:880px;margin:0 auto;padding:24px 16px}
.hero{background:linear-gradient(135deg,var(--p),var(--a));color:#fff;padding:64px 16px;text-align:center}
.hero h1{font-size:clamp(28px,5vw,52px);font-weight:800;line-height:1.15;max-width:880px;margin:0 auto}
.hero p{font-size:clamp(16px,2.4vw,20px);opacity:.95;max-width:720px;margin:18px auto 0}
.cta{display:inline-block;background:#fff;color:var(--p);font-weight:700;padding:18px 36px;border-radius:14px;text-decoration:none;margin-top:28px;box-shadow:0 8px 24px rgba(0,0,0,.15);font-size:17px}
.product{display:grid;gap:16px;justify-items:center}
.product img{max-width:100%;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.15)}
.video{width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.15)}
.video iframe{width:100%;height:100%;border:0}
.vslbox{border-radius:16px;overflow:hidden}
.vsl-placeholder{aspect-ratio:16/9;background:#0f172a;color:#cbd5e1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:20px}
.vsl-play{width:74px;height:74px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px}
section{padding:48px 0;border-bottom:1px solid var(--border)}
h2{font-size:clamp(22px,3vw,32px);margin-bottom:20px;text-align:center}
.promise{background:var(--surface);padding:32px;border-radius:16px;text-align:center;font-size:18px;font-weight:500}
.dorbox{max-width:720px;margin:0 auto;font-size:17px;line-height:1.8}
.dorbox p{margin-bottom:14px}
.mecabox{background:var(--surface);border:2px solid var(--p);border-radius:18px;padding:28px;max-width:760px;margin:0 auto;text-align:center}
.meca-nome{font-size:clamp(20px,3vw,28px);font-weight:800;color:var(--p);margin-bottom:12px}
.mecabox p{margin-bottom:10px;font-size:16px}
ul.feat{list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
ul.feat li{background:var(--surface);padding:16px 20px;border-radius:12px;border-left:4px solid var(--p)}
.stackbox{background:#fff;border:2px dashed var(--p);border-radius:18px;padding:28px;max-width:640px;margin:0 auto;text-align:center}
.stackbox ul{list-style:none;text-align:left;margin-bottom:18px}
.stackbox li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:15px}
.stack-valor{color:var(--muted);white-space:nowrap}
.stack-total{font-size:16px;color:var(--muted);margin-bottom:6px}
.stack-anchor{font-size:14px;color:var(--muted);margin-bottom:8px}
.offer{background:linear-gradient(135deg,#f5f3ff,#ede9fe);padding:40px;border-radius:20px;text-align:center}
.price{font-size:36px;font-weight:800;color:var(--p);margin:12px 0}
.offer .cta,.stackbox .cta,.final .cta{background:linear-gradient(135deg,var(--p),var(--a));color:#fff}
.bonus{background:#fef3c7;padding:24px;border-radius:14px}
.bonus h3{margin-bottom:12px;color:#92400e}
.bonus ul{padding-left:20px}
.guarantee{background:#ecfdf5;border:2px solid #10b981;padding:28px;border-radius:16px;text-align:center}
.guarantee h3{color:#065f46;margin-bottom:10px}
.urgbox{background:#fef3c7;border:2px solid #f59e0b;border-radius:14px;padding:20px 24px;text-align:center;color:#78350f}
.urgbox p{margin-top:6px}
.testis{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.testis blockquote{background:var(--surface);padding:20px;border-radius:12px;border-left:4px solid var(--a)}
.testis cite{display:block;margin-top:10px;font-weight:600;color:var(--muted);font-style:normal}
.t-img{max-width:100%;border-radius:10px;margin-bottom:12px}
.g-img{max-width:140px;margin:0 auto 14px;display:block}
.t-stars{font-size:16px;margin-bottom:8px}
.placeholder-notice{text-align:center;font-size:12px;color:var(--muted);margin-top:16px;font-style:italic}
details{background:var(--surface);padding:16px 20px;border-radius:10px;margin-bottom:10px;cursor:pointer}
details summary{font-weight:600;list-style:none}
.final{background:#0f172a;color:#fff;padding:64px 16px;text-align:center}
.final h2{color:#fff}
footer{padding:24px;text-align:center;color:var(--muted);font-size:13px}
@media (max-width:640px){.cta{display:block;text-align:center;width:100%}}
${themeCss(theme)}
</style></head>
<body>
${sec.join("\n")}
<footer>
<p>Resultados podem variar de pessoa para pessoa. Nenhum resultado específico é garantido.</p>
<p>Este produto não substitui aconselhamento profissional. Ao comprar, você concorda com os termos da plataforma de pagamento.</p>
<p style="margin-top:8px">© ${new Date().getFullYear()} · Criado com FunnelBook AI</p>
</footer>
</body></html>`;
}
