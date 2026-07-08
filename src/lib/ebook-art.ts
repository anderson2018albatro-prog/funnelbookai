// Arte programática do ebook: capa profissional e banners decorativos por
// capítulo gerados 100% por código (SVG), sem depender de APIs de imagem.
// Usado pelo editor visual e pelo export PDF (via conversão SVG → PNG canvas).

export type EbookPalette = {
  from: string;
  to: string;
  accent: string;
  name: string;
};

const PALETTES: EbookPalette[] = [
  { name: "indigo", from: "#4f46e5", to: "#7c3aed", accent: "#fbbf24" },
  { name: "ocean", from: "#0369a1", to: "#0891b2", accent: "#fde047" },
  { name: "emerald", from: "#047857", to: "#0d9488", accent: "#fef08a" },
  { name: "sunset", from: "#b91c1c", to: "#ea580c", accent: "#fef9c3" },
  { name: "royal", from: "#1e3a8a", to: "#6d28d9", accent: "#f472b6" },
  { name: "wine", from: "#831843", to: "#be185d", accent: "#fbbf24" },
  { name: "forest", from: "#14532d", to: "#3f6212", accent: "#fde68a" },
  { name: "slate", from: "#0f172a", to: "#334155", accent: "#38bdf8" },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function paletteFor(seed: string): EbookPalette {
  return PALETTES[hashStr(seed || "ebook") % PALETTES.length];
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

/** Quebra texto em linhas de no máximo maxChars, sem cortar palavras. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (words.join(" ").length > lines.join(" ").length && lines.length === maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

const tspans = (lines: string[], x: number, y0: number, lh: number) =>
  lines.map((l, i) => `<tspan x="${x}" y="${y0 + i * lh}">${esc(l)}</tspan>`).join("");

/**
 * Capa profissional do ebook: gradiente, tipografia hierárquica, formas
 * decorativas e "mockup" de faixa inferior com autor.
 * Dimensões: 1000 × 1414 (proporção A4).
 */
export function coverSvg(opts: {
  title: string;
  subtitle?: string;
  promise?: string;
  author?: string;
  seed?: string;
  /** Data URL de imagem de capa (IA ou upload). Layout muda para janela + título abaixo. */
  imageHref?: string;
}): string {
  const p = paletteFor(opts.seed || opts.title);
  const hasImage = !!opts.imageHref;
  const titleLines = wrapText(opts.title, hasImage ? 24 : 20, hasImage ? 3 : 4);
  const titleSize = hasImage
    ? (titleLines.length >= 3 ? 58 : titleLines.length === 2 ? 68 : 76)
    : (titleLines.length >= 4 ? 72 : titleLines.length === 3 ? 80 : 92);
  const subLines = wrapText(opts.subtitle ?? "", hasImage ? 48 : 42, hasImage ? 2 : 3);
  const promiseLines = wrapText(opts.promise ?? "", 38, 2);
  const titleY = hasImage ? 950 : 480;
  const subY = titleY + titleLines.length * (titleSize + 8) + (hasImage ? 30 : 40);

  const imageWindow = hasImage
    ? `<defs><clipPath id="coverimg"><rect x="90" y="290" width="820" height="540" rx="24"/></clipPath></defs>
<image href="${opts.imageHref}" x="90" y="290" width="820" height="540" preserveAspectRatio="xMidYMid slice" clip-path="url(#coverimg)"/>
<rect x="90" y="290" width="820" height="540" rx="24" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="3"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1414" viewBox="0 0 1000 1414">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/>
  </linearGradient>
  <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".14"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="1000" height="1414" fill="url(#bg)"/>
<circle cx="880" cy="120" r="260" fill="#ffffff" opacity=".07"/>
<circle cx="60" cy="1320" r="300" fill="#000000" opacity=".10"/>
<circle cx="930" cy="1100" r="150" fill="${p.accent}" opacity=".16"/>
<rect width="1000" height="707" fill="url(#shine)"/>
<rect x="90" y="150" width="120" height="10" rx="5" fill="${p.accent}"/>
${promiseLines.length ? `<text font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="30" fill="#ffffff" opacity=".92">${tspans(promiseLines, 92, 220, 42)}</text>` : ""}
${imageWindow}
<text font-family="'Segoe UI', Arial, sans-serif" font-weight="800" font-size="${titleSize}" fill="#ffffff" letter-spacing="-1">${tspans(titleLines, 90, titleY, titleSize + 8)}</text>
${subLines.length ? `<text font-family="'Segoe UI', Arial, sans-serif" font-size="34" fill="#ffffff" opacity=".85">${tspans(subLines, 92, subY, 46)}</text>` : ""}
<rect x="0" y="1230" width="1000" height="184" fill="#000000" opacity=".22"/>
<rect x="90" y="1230" width="820" height="3" fill="${p.accent}" opacity=".9"/>
${opts.author ? `<text x="92" y="1310" font-family="'Segoe UI', Arial, sans-serif" font-weight="700" font-size="34" fill="#ffffff">${esc(opts.author)}</text>` : ""}
<text x="92" y="${opts.author ? 1358 : 1320}" font-family="'Segoe UI', Arial, sans-serif" font-size="22" fill="#ffffff" opacity=".7">E-BOOK EXCLUSIVO</text>
</svg>`;
}

/** Baixa uma imagem (ex.: Supabase Storage) e devolve como data URL — evita
 *  canvas "tainted" ao rasterizar SVG e permite embutir no jsPDF. */
export function fetchImageAsDataUrl(url: string): Promise<string | null> {
  return fetch(url)
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => {
      if (!blob) return null;
      return new Promise<string | null>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    })
    .catch(() => null);
}

/** Dimensões naturais de uma imagem (data URL ou URL). */
export function imageDimensions(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Ícones decorativos simples por índice de capítulo. */
function chapterGlyph(i: number, cx: number, cy: number, color: string): string {
  const g = i % 6;
  switch (g) {
    case 0: // alvo
      return `<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="${color}" stroke-width="6" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="${color}" stroke-width="6" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="8" fill="${color}"/>`;
    case 1: // raio
      return `<path d="M ${cx + 6} ${cy - 50} L ${cx - 30} ${cy + 8} L ${cx - 2} ${cy + 8} L ${cx - 10} ${cy + 50} L ${cx + 30} ${cy - 10} L ${cx + 2} ${cy - 10} Z" fill="${color}" opacity=".95"/>`;
    case 2: // gráfico crescente
      return `<path d="M ${cx - 45} ${cy + 40} L ${cx - 15} ${cy + 5} L ${cx + 5} ${cy + 22} L ${cx + 45} ${cy - 40}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M ${cx + 22} ${cy - 40} L ${cx + 45} ${cy - 40} L ${cx + 45} ${cy - 17}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`;
    case 3: // lâmpada
      return `<circle cx="${cx}" cy="${cy - 8}" r="30" fill="none" stroke="${color}" stroke-width="6"/><rect x="${cx - 12}" y="${cy + 24}" width="24" height="8" rx="4" fill="${color}"/><rect x="${cx - 9}" y="${cy + 36}" width="18" height="6" rx="3" fill="${color}"/><path d="M ${cx} ${cy - 22} L ${cx} ${cy - 2} M ${cx - 10} ${cy - 12} L ${cx + 10} ${cy - 12}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
    case 4: // check
      return `<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="${color}" stroke-width="6" opacity=".9"/><path d="M ${cx - 20} ${cy} L ${cx - 5} ${cy + 16} L ${cx + 24} ${cy - 18}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
    default: // estrela
      return `<path d="M ${cx} ${cy - 46} L ${cx + 13} ${cy - 14} L ${cx + 46} ${cy - 12} L ${cx + 20} ${cy + 10} L ${cx + 29} ${cy + 42} L ${cx} ${cy + 23} L ${cx - 29} ${cy + 42} L ${cx - 20} ${cy + 10} L ${cx - 46} ${cy - 12} L ${cx - 13} ${cy - 14} Z" fill="${color}" opacity=".95"/>`;
  }
}

/**
 * Banner decorativo do capítulo: gradiente, número grande, ícone geométrico
 * e a descrição da imagem sugerida pela IA como legenda visual.
 * Dimensões: 1200 × 340.
 */
export function chapterBannerSvg(opts: {
  index: number;
  title: string;
  imageDescription?: string;
  seed?: string;
}): string {
  const p = paletteFor(opts.seed || opts.title);
  const titleLines = wrapText(opts.title, 34, 2);
  const descLines = wrapText(opts.imageDescription ?? "", 60, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="340" viewBox="0 0 1200 340">
<defs>
  <linearGradient id="cb" x1="0" y1="0" x2="1" y2=".6">
    <stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/>
  </linearGradient>
</defs>
<rect width="1200" height="340" fill="url(#cb)"/>
<circle cx="1080" cy="60" r="180" fill="#ffffff" opacity=".08"/>
<circle cx="80" cy="320" r="140" fill="#000000" opacity=".12"/>
<rect x="0" y="330" width="1200" height="10" fill="${p.accent}"/>
<text x="64" y="218" font-family="'Segoe UI', Arial, sans-serif" font-weight="800" font-size="190" fill="#ffffff" opacity=".16">${String(opts.index + 1).padStart(2, "0")}</text>
<text x="64" y="96" font-family="'Segoe UI', Arial, sans-serif" font-weight="700" font-size="22" letter-spacing="4" fill="${p.accent}">CAPÍTULO ${opts.index + 1}</text>
<text font-family="'Segoe UI', Arial, sans-serif" font-weight="800" font-size="44" fill="#ffffff">${tspans(titleLines, 64, 160, 54)}</text>
${descLines.length ? `<text font-family="Georgia, serif" font-style="italic" font-size="21" fill="#ffffff" opacity=".78">${tspans(descLines, 64, 160 + titleLines.length * 54 + 10, 30)}</text>` : ""}
${chapterGlyph(opts.index, 1090, 250, "#ffffff")}
</svg>`;
}

/** Divisor decorativo horizontal (usado entre seções no PDF). 1200 × 40. */
export function dividerSvg(seed: string): string {
  const p = paletteFor(seed);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="40" viewBox="0 0 1200 40">
<line x1="80" y1="20" x2="540" y2="20" stroke="${p.from}" stroke-width="3" opacity=".5"/>
<line x1="660" y1="20" x2="1120" y2="20" stroke="${p.to}" stroke-width="3" opacity=".5"/>
<circle cx="600" cy="20" r="9" fill="none" stroke="${p.accent}" stroke-width="3"/>
<circle cx="600" cy="20" r="3" fill="${p.accent}"/>
</svg>`;
}

/** Data URL de SVG para uso direto em <img src>. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Converte SVG em PNG data URL via canvas (para jsPDF, que não lê SVG). */
export function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svgDataUrl(svg);
  });
}
