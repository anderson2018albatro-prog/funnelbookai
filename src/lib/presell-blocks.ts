// Presell / Bridge page blocks: types and HTML renderer.
// Ethical only: NO cookie stuffing, NO invisible redirects, NO auto-fired affiliate links.
// Every CTA is a real anchor with target="_blank" rel="sponsored noopener noreferrer".

export type PresellType =
  | "review" | "advertorial" | "quiz" | "comparativo" | "bridge" | "bridge_story" | "vsl" | "cookie_notice"
  | "native_ad" | "story" | "listicle"
  | "age_gate" | "gender_gate" | "country_gate" | "captcha_gate" | "coupon" | "countdown";

export type PresellBlockKey =
  | "topbar" | "headline" | "rating" | "media" | "intro" | "what_is" | "for_whom"
  | "benefits" | "pros" | "cons" | "story" | "how_it_works" | "proof" | "trust_badges"
  | "comparison" | "quiz" | "video" | "cookie_notice" | "cta" | "faq"
  | "countdown_timer" | "coupon_widget" | "whatsapp_button"
  | "urgency_bar" | "viewers_counter" | "testimonials" | "comments" | "author_byline";

export type PresellTheme = {
  primary: string;
  accent: string;
  bg: string;
  text: string;
};

export type PresellPixels = {
  facebook: string; // Facebook Pixel ID (instalação padrão)
  google: string;   // Google tag ID (gtag, instalação padrão)
};

export type PresellBlocks = {
  type: PresellType;
  order: PresellBlockKey[];
  affiliate_url: string;
  /** Link da página oficial do produto (informação complementar; o CTA principal continua sendo o link de afiliado). */
  official_url?: string;
  disclosure_text: string;
  theme: PresellTheme;
  pixels?: PresellPixels;
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
    cta: { visible: boolean; text: string; note: string; sticky: boolean; reveal_after_seconds?: number };
    faq: { visible: boolean; title: string; items: { q: string; a: string }[] };
    countdown_timer: { visible: boolean; minutes: number; message: string };
    coupon_widget: { visible: boolean; code: string; discount_pct: string; expires_minutes: number };
    whatsapp_button: { visible: boolean; phone: string; message: string; color: string };
    urgency_bar: { visible: boolean; text: string };
    viewers_counter: { visible: boolean; min: number; max: number };
    testimonials: { visible: boolean; title: string; items: { name: string; text: string; stars: number }[] };
    comments: { visible: boolean; title: string; items: { name: string; text: string; likes: number; time: string }[] };
    author_byline: { visible: boolean; name: string; role: string; date: string };
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
  countdown_timer: "Timer de urgência",
  coupon_widget: "Cupom de desconto",
  whatsapp_button: "Botão WhatsApp flutuante",
  urgency_bar: "Barra de urgência (topo)",
  viewers_counter: "Contador de pessoas vendo",
  testimonials: "Depoimentos (prova social)",
  comments: "Comentários (estilo rede social)",
  author_byline: "Autor / data (matéria)",
};

export const PRESELL_TYPE_LABELS: Record<PresellType, string> = {
  // ── Conteúdo completo ──────────────────────────────────────────────────
  review: "Review Premium",
  advertorial: "Advertorial (matéria editorial)",
  story: "Narrativa de Transformação",
  bridge_story: "Bridge Story (ponte narrativa)",
  native_ad: "Anúncio Nativo (artigo patrocinado)",
  listicle: "Listicle (Top Razões)",
  // ── Interação / escolha ───────────────────────────────────────────────
  quiz: "Quiz Presell",
  comparativo: "Comparativo de produtos",
  vsl: "VSL Presell (vídeo)",
  // ── Urgência / oferta ─────────────────────────────────────────────────
  coupon: "Cupom de Desconto + Timer",
  countdown: "Timer de Urgência",
  // ── Gate pages (zero escape) ──────────────────────────────────────────
  age_gate: "Gate de Idade (Zero Escape) ⚡",
  gender_gate: "Gate de Gênero ⚡",
  country_gate: "Gate de País / Bandeiras ⚡",
  captcha_gate: "CAPTCHA de Segurança ⚡",
  // ── Simples ───────────────────────────────────────────────────────────
  bridge: "Bridge Page direta",
  cookie_notice: "Aviso de redirecionamento",
};

export const DEFAULT_THEME: PresellTheme = {
  primary: "#6366f1",
  accent: "#06b6d4",
  bg: "#ffffff",
  text: "#0f172a",
};

export const DEFAULT_DISCLOSURE =
  "Esta página pode conter links de afiliado. Podemos receber comissão por compras realizadas, sem custo adicional para você.";

const GATE_TYPES: PresellType[] = ["age_gate", "gender_gate", "country_gate", "captcha_gate"];

export function defaultOrderFor(type: PresellType): PresellBlockKey[] {
  switch (type) {
    case "review":
      return ["urgency_bar","topbar","headline","viewers_counter","rating","media","intro","what_is","how_it_works","benefits","pros","cons","for_whom","testimonials","trust_badges","cta","faq","comments"];
    case "advertorial":
      return ["urgency_bar","topbar","headline","author_byline","media","story","what_is","how_it_works","benefits","proof","testimonials","trust_badges","cta","faq","comments"];
    case "quiz":
      return ["urgency_bar","topbar","headline","viewers_counter","quiz","testimonials","trust_badges","cta"];
    case "comparativo":
      return ["urgency_bar","topbar","headline","viewers_counter","comparison","benefits","testimonials","trust_badges","cta","faq"];
    case "bridge":
      return ["topbar","headline","benefits","testimonials","cookie_notice","cta"];
    case "bridge_story":
      // Ponte narrativa ética: sem urgency_bar, sem viewers_counter, sem
      // depoimentos/comentários fabricados, sem popup — só conteúdo real + CTA claro.
      return ["topbar","headline","story","how_it_works","benefits","cta"];
    case "vsl":
      return ["urgency_bar","topbar","headline","viewers_counter","video","benefits","testimonials","trust_badges","cta","faq"];
    case "cookie_notice":
      return ["topbar","headline","cookie_notice","cta"];
    case "native_ad":
      return ["topbar","headline","author_byline","media","intro","story","what_is","benefits","proof","testimonials","cta","faq","comments"];
    case "story":
      return ["urgency_bar","topbar","headline","story","what_is","how_it_works","benefits","pros","testimonials","trust_badges","cta","faq","comments"];
    case "listicle":
      return ["urgency_bar","topbar","headline","media","intro","benefits","pros","proof","testimonials","trust_badges","cta","faq"];
    case "age_gate":
    case "gender_gate":
    case "country_gate":
    case "captcha_gate":
      return ["topbar","headline","cta"];
    case "coupon":
      return ["urgency_bar","topbar","headline","viewers_counter","coupon_widget","benefits","testimonials","cta"];
    case "countdown":
      return ["urgency_bar","topbar","headline","viewers_counter","countdown_timer","benefits","trust_badges","testimonials","cta"];
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
      cta: { visible: true, text: "Acessar site oficial", note: "Você será redirecionado para o site oficial do produto.", sticky: true, reveal_after_seconds: 0 },
      faq: { visible: true, title: "Perguntas frequentes", items: [] },
      countdown_timer: { visible: type === "countdown", minutes: 15, message: "⏰ Oferta por tempo limitado!" },
      coupon_widget: { visible: type === "coupon", code: "PROMO10", discount_pct: "10% de desconto", expires_minutes: 20 },
      whatsapp_button: { visible: false, phone: "", message: "Olá! Tenho interesse neste produto.", color: "#25d366" },
      urgency_bar: { visible: false, text: "🔥 Atenção: condição especial disponível por tempo limitado" },
      viewers_counter: { visible: false, min: 34, max: 97 },
      testimonials: { visible: false, title: "O que estão dizendo", items: [] },
      comments: { visible: false, title: "Comentários", items: [] },
      author_byline: { visible: false, name: "Redação", role: "Equipe editorial", date: "" },
    },
  };
}

/** Presell de exemplo por formato — usada no preview da tela de criação. */
export function samplePresell(type: PresellType): PresellBlocks {
  const b = emptyPresell(type, "#exemplo");
  const d = b.data;
  d.headline.title = "Exemplo: [Produto] vale a pena? Veja isto antes de comprar";
  d.headline.subtitle = "Analisamos a fundo para você decidir com segurança (conteúdo real gerado pela IA)";
  d.intro.text = "Este é um preview de exemplo do formato.\n\nO conteúdo real é escrito pela IA com base no seu produto, nicho e público.";
  d.what_is.text = "Aqui a IA explica o que é o produto, para quem ele foi feito e por que ele chama atenção no mercado.";
  d.story.text = "Eu já tinha tentado de tudo e nada funcionava.\n\nAté que encontrei uma abordagem diferente — e foi aí que as coisas mudaram.\n\nNesta seção a IA conta uma narrativa em primeira pessoa que conecta a dor do leitor ao produto.";
  d.how_it_works.text = "Passo a passo de como o produto funciona na prática, explicado de forma simples.";
  d.benefits.items = ["Benefício específico nº 1", "Benefício específico nº 2", "Benefício específico nº 3", "Benefício específico nº 4"];
  d.pros.items = ["Ponto positivo real", "Outro ponto forte"];
  d.cons.items = ["Ponto de atenção honesto"];
  d.for_whom.items = ["Perfil de leitor 1", "Perfil de leitor 2", "Perfil de leitor 3"];
  d.proof.items = ["Mais de 10.000 clientes atendidos", "Método com base científica"];
  d.trust_badges.visible = true;
  d.faq.items = [
    { q: "Tem garantia?", a: "Sim, garantia oficial do produtor." },
    { q: "Como recebo o acesso?", a: "Por e-mail, minutos após a confirmação." },
  ];
  d.comparison.rows = [
    { feature: "Garantia", a: "30 dias", b: "Sem garantia" },
    { feature: "Suporte", a: "Oficial", b: "Inexistente" },
    { feature: "Preço", a: "Promocional", b: "Variável" },
  ];
  d.comparison.winner = "Produto Oficial";
  d.quiz.questions = [
    { question: "Qual é o seu maior objetivo hoje?", options: ["Resultados rápidos", "Resultado duradouro", "Só estou pesquisando"] },
    { question: "Quanto tempo por dia você tem disponível?", options: ["Menos de 15 min", "30 min", "1 hora ou mais"] },
  ];
  d.quiz.result = "Com base nas suas respostas, esta é a solução recomendada para o seu perfil.";
  const isGate = (GATE_TYPES as string[]).includes(type);
  d.urgency_bar.visible = !isGate && !["cookie_notice", "bridge", "bridge_story"].includes(type);
  d.viewers_counter.visible = d.urgency_bar.visible;
  d.testimonials.visible = !isGate && !["cookie_notice", "bridge_story"].includes(type);
  d.testimonials.items = [
    { name: "Mariana L.", text: "Comecei sem esperar muito e me surpreendi com o resultado.", stars: 5 },
    { name: "Rafael S.", text: "Valeu cada centavo. O suporte respondeu rápido.", stars: 4 },
  ];
  d.comments.visible = ["review", "advertorial", "native_ad", "story"].includes(type);
  d.comments.items = [
    { name: "Camila Rodrigues", text: "Alguém já testou? To quase pedindo", likes: 12, time: "2 h" },
    { name: "Pedro Henrique", text: "comprei semana passada, chegou certinho", likes: 8, time: "5 h" },
  ];
  d.author_byline.visible = ["advertorial", "native_ad"].includes(type);
  d.author_byline.name = "Carla M.";
  d.author_byline.role = "Redação";
  if (type === "bridge_story") {
    d.cookie_notice.visible = false; // sem popup — o CTA já diz o que faz
    d.topbar.text = "Conteúdo de parceiro · pode conter links de afiliado";
    d.headline.title = "Exemplo: Eu quase desisti — até mudar uma coisa na minha rotina";
    d.headline.subtitle = "Uma história real do público, sem promessas milagrosas (conteúdo gerado pela IA)";
    d.story.title = "Minha história";
    d.story.text = "Aqui a IA abre com uma situação/dor real do público-alvo, em primeira pessoa, criando identificação genuína.\n\nDepois conta como a pessoa chegou até a solução — a descoberta — sem exageros e sem clickbait.";
    d.how_it_works.title = "O que eu encontrei";
    d.how_it_works.text = "Nesta seção a IA faz a transição suave: apresenta o produto de forma natural, explicando o que ele é e por que fez diferença.";
    d.benefits.title = "O que mudou pra mim";
    d.benefits.items = ["Benefício real e verificável nº 1", "Benefício real e verificável nº 2", "Benefício real e verificável nº 3"];
    d.cta.text = "Quero conhecer o método";
    d.cta.note = "Você será levado ao site oficial do produto. Link de afiliado — sem custo extra pra você.";
  }
  return b;
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

function proseHtml(text: string): string {
  if (!text) return "";
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Gate pages renderer (age_gate, gender_gate, country_gate, captcha_gate)
// These are minimal standalone pages — very high CTR, "zero escape rate"
// ─────────────────────────────────────────────────────────────────────────────
function renderGateHtml(blocks: PresellBlocks, fallbackTitle: string): string {
  const d = blocks.data;
  const aff = esc(blocks.affiliate_url || "#");
  const theme = blocks.theme ?? DEFAULT_THEME;
  const type = blocks.type;
  const disclosure = blocks.disclosure_text || DEFAULT_DISCLOSURE;
  const title = d.headline?.title || fallbackTitle;
  const subtitle = d.headline?.subtitle || "";
  const ctaText = d.cta?.text || "Acessar site oficial";
  const p = theme.primary;
  const a = theme.accent;

  const head = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',system-ui,sans-serif}</style>
</head>`;

  // ── AGE GATE ─────────────────────────────────────────────────────────────
  if (type === "age_gate") {
    return `${head}
<body style="min-height:100vh;background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;align-items:center;justify-content:center;padding:20px">
<div style="background:#1e293b;border:1px solid #334155;border-radius:24px;padding:clamp(32px,5vw,52px);max-width:520px;width:100%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,.5)">
  <div style="font-size:52px;margin-bottom:18px">🔒</div>
  <h1 style="color:#f1f5f9;font-size:clamp(18px,4vw,26px);font-weight:800;margin-bottom:12px;line-height:1.3">${esc(title)}</h1>
  ${subtitle ? `<p style="color:#94a3b8;font-size:15px;margin-bottom:24px;line-height:1.6">${esc(subtitle)}</p>` : ""}
  <div style="background:#0f172a;border:1px solid #334155;border-radius:14px;padding:18px 20px;margin-bottom:28px;text-align:left">
    <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">⚠ Verificação Necessária</div>
    <div style="color:#cbd5e1;font-size:14px;line-height:1.6">Este conteúdo é destinado exclusivamente a <strong style="color:#f1f5f9">maiores de 18 anos</strong>. Ao continuar, você confirma que atende a esse requisito.</div>
  </div>
  <a href="${aff}" target="_blank" rel="sponsored noopener noreferrer" data-cta="1"
     style="display:block;background:linear-gradient(135deg,${esc(p)},${esc(a)});color:#fff;font-weight:700;font-size:clamp(15px,3vw,18px);padding:20px 32px;border-radius:14px;text-decoration:none;box-shadow:0 12px 32px rgba(99,102,241,.35);margin-bottom:12px;transition:transform .1s"
     onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
    ✓ ${esc(ctaText)} →
  </a>
  <p style="color:#475569;font-size:12px">Ao clicar, você declara ter 18+ anos e será redirecionado ao site oficial</p>
  <hr style="border:none;border-top:1px solid #334155;margin:24px 0">
  <p style="color:#475569;font-size:11px;line-height:1.6">${esc(disclosure)}</p>
</div>
</body></html>`;
  }

  // ── GENDER GATE ───────────────────────────────────────────────────────────
  if (type === "gender_gate") {
    return `${head}
<body style="min-height:100vh;background:linear-gradient(135deg,${esc(p)}18,${esc(a)}18,#f8fafc);display:flex;align-items:center;justify-content:center;padding:20px">
<div style="background:#fff;border-radius:24px;padding:clamp(32px,5vw,52px);max-width:560px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.1)">
  <h1 style="color:#0f172a;font-size:clamp(20px,4vw,30px);font-weight:800;margin-bottom:12px;line-height:1.3">${esc(title)}</h1>
  <p style="color:#64748b;font-size:16px;margin-bottom:36px">${subtitle || "Selecione o seu perfil para continuar"}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px">
    <a href="${aff}" target="_blank" rel="sponsored noopener noreferrer" data-cta="1"
       style="display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;font-size:17px;padding:32px 20px;border-radius:18px;text-decoration:none;box-shadow:0 10px 28px rgba(59,130,246,.3);transition:transform .1s"
       onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='none'">
      <span style="font-size:48px">👨</span>
      <span>Masculino</span>
    </a>
    <a href="${aff}" target="_blank" rel="sponsored noopener noreferrer" data-cta="1"
       style="display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(135deg,#ec4899,#db2777);color:#fff;font-weight:700;font-size:17px;padding:32px 20px;border-radius:18px;text-decoration:none;box-shadow:0 10px 28px rgba(236,72,153,.3);transition:transform .1s"
       onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='none'">
      <span style="font-size:48px">👩</span>
      <span>Feminino</span>
    </a>
  </div>
  <p style="color:#94a3b8;font-size:11px;line-height:1.6">${esc(disclosure)}</p>
</div>
</body></html>`;
  }

  // ── COUNTRY GATE ─────────────────────────────────────────────────────────
  if (type === "country_gate") {
    const countries = [
      { flag: "🇧🇷", name: "Brasil" }, { flag: "🇺🇸", name: "EUA" }, { flag: "🇵🇹", name: "Portugal" },
      { flag: "🇪🇸", name: "Espanha" }, { flag: "🇦🇷", name: "Argentina" }, { flag: "🇲🇽", name: "México" },
      { flag: "🇨🇴", name: "Colômbia" }, { flag: "🇨🇱", name: "Chile" }, { flag: "🇫🇷", name: "França" },
      { flag: "🇩🇪", name: "Alemanha" }, { flag: "🇬🇧", name: "UK" }, { flag: "🇮🇹", name: "Itália" },
    ];
    const flagGrid = countries.map((c) =>
      `<a href="${aff}" target="_blank" rel="sponsored noopener noreferrer" data-cta="1"
         style="display:flex;flex-direction:column;align-items:center;gap:6px;background:#f8fafc;border:2px solid #e2e8f0;padding:16px 10px;border-radius:14px;text-decoration:none;color:#0f172a;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s"
         onmouseover="this.style.borderColor='${esc(p)}';this.style.background='${esc(p)}12';this.style.transform='scale(1.04)'"
         onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#f8fafc';this.style.transform='scale(1)'">
        <span style="font-size:34px">${c.flag}</span>
        <span>${c.name}</span>
      </a>`
    ).join("");
    return `${head}
<body style="min-height:100vh;background:#f1f5f9;display:flex;align-items:center;justify-content:center;padding:20px">
<div style="background:#fff;border-radius:24px;padding:clamp(28px,5vw,48px);max-width:700px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.08)">
  <h1 style="color:#0f172a;font-size:clamp(18px,3.5vw,28px);font-weight:800;margin-bottom:10px;line-height:1.3">${esc(title)}</h1>
  <p style="color:#64748b;font-size:15px;margin-bottom:28px">${subtitle || "Selecione o seu país para continuar"}</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;margin-bottom:28px">
    ${flagGrid}
  </div>
  <p style="color:#94a3b8;font-size:11px;line-height:1.6">${esc(disclosure)}</p>
</div>
</body></html>`;
  }

  // ── CAPTCHA GATE ─────────────────────────────────────────────────────────
  if (type === "captcha_gate") {
    return `${head}
<body style="min-height:100vh;background:#f1f5f9;display:flex;align-items:center;justify-content:center;padding:20px">
<div style="max-width:460px;width:100%">
  <div style="background:#fff;border-radius:24px;padding:36px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.08);margin-bottom:16px">
    <div style="font-size:52px;margin-bottom:16px">🌐</div>
    <h1 style="color:#0f172a;font-size:clamp(17px,3.5vw,24px);font-weight:800;margin-bottom:10px;line-height:1.3">${esc(title)}</h1>
    ${subtitle ? `<p style="color:#64748b;font-size:14px;margin-bottom:0;line-height:1.6">${esc(subtitle)}</p>` : ""}
  </div>
  <div style="background:#fff;border-radius:20px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,.06);margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border:2px solid #e2e8f0;border-radius:12px;background:#f8fafc;cursor:pointer" onclick="verify()">
      <div style="display:flex;align-items:center;gap:14px">
        <div id="cb" style="width:28px;height:28px;border:2px solid #9ca3af;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .25s;flex-shrink:0"> </div>
        <span style="color:#374151;font-size:15px;font-weight:500;user-select:none">Não sou robô</span>
      </div>
      <div style="text-align:right">
        <div style="font-size:26px">🔒</div>
        <div style="font-size:9px;color:#9ca3af;line-height:1.3">reCAPTCHA<br>Privacidade · Termos</div>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:10px">Clique na caixa acima para confirmar</p>
  </div>
  <a href="${aff}" target="_blank" rel="sponsored noopener noreferrer" data-cta="1" id="ctaBtn"
     style="display:block;background:linear-gradient(135deg,${esc(p)},${esc(a)});color:#fff;font-weight:700;font-size:17px;padding:20px;border-radius:14px;text-decoration:none;text-align:center;box-shadow:0 10px 28px rgba(99,102,241,.3);opacity:0.35;pointer-events:none;transition:all .3s">
    ${esc(ctaText)} →
  </a>
  <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:14px;line-height:1.6">${esc(disclosure)}</p>
</div>
<script>
function verify(){
  var cb=document.getElementById('cb'),btn=document.getElementById('ctaBtn');
  cb.innerHTML='✓';cb.style.background='#10b981';cb.style.borderColor='#10b981';cb.style.color='#fff';
  setTimeout(function(){btn.style.opacity='1';btn.style.pointerEvents='auto';},700);
}
</script>
</body></html>`;
  }

  // Fallback
  return `${head}
<body style="min-height:100vh;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:20px">
<div style="background:#fff;border-radius:24px;padding:48px;max-width:520px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.08)">
  <h1 style="color:#0f172a;font-size:28px;font-weight:800;margin-bottom:16px">${esc(title)}</h1>
  ${subtitle ? `<p style="color:#64748b;font-size:16px;margin-bottom:32px">${esc(subtitle)}</p>` : ""}
  <a href="${aff}" target="_blank" rel="sponsored noopener noreferrer" data-cta="1"
     style="display:block;background:linear-gradient(135deg,${esc(p)},${esc(a)});color:#fff;font-weight:700;font-size:18px;padding:22px;border-radius:14px;text-decoration:none">
    ${esc(ctaText)} →
  </a>
  <p style="color:#94a3b8;font-size:11px;margin-top:24px;line-height:1.6">${esc(disclosure)}</p>
</div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific CSS overrides
// ─────────────────────────────────────────────────────────────────────────────
function typeStyles(type: PresellType): string {
  switch (type) {
    case "advertorial":
      return `
body{font-family:'Georgia','Times New Roman',serif;background:#fafaf9}
.topbar{background:#1e293b;font-family:Georgia,serif;font-size:12px;letter-spacing:2.5px}
.hero{background:#1e293b;padding:52px 20px}.hero::before{background:none}
.band.alt{background:#f5f5f0}
h2{font-family:Georgia,serif;font-style:italic;letter-spacing:0}
.prose,.lead{font-family:Georgia,serif;font-size:17px;line-height:1.85}
.lead{font-size:21px;font-style:italic}
.cards li{background:#f5f5f0;border-left-color:#1e293b}.cards li::before{background:#1e293b}
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
.cards li{border-left-color:#f59e0b}.cards li::before{background:#f59e0b}`;
    case "quiz":
      return `
.hero{background:linear-gradient(135deg,#7c3aed,#6d28d9)}
.topbar{background:#6d28d9}
.q{border:2px solid #ede9fe;border-radius:18px;padding:24px;transition:border-color .2s}
.q:hover{border-color:#7c3aed}
.q h3{color:#4c1d95;font-size:17px}.q ul{list-style:none;display:grid;gap:8px;margin-top:0}
.q ul li{background:#f5f3ff;padding:12px 16px;border-radius:10px;border-left:3px solid #7c3aed;font-size:15px}
.result{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;padding:20px 24px;font-size:17px}
.cta,.cta-large{background:linear-gradient(135deg,#7c3aed,#f59e0b)}
.cards li::before{background:#7c3aed}.cards li{border-left-color:#7c3aed}`;
    case "comparativo":
      return `
.hero{background:linear-gradient(135deg,#0ea5e9,#0284c7)}
.topbar{background:#0369a1}
.cmp th:nth-child(2){background:#dcfce7;color:#166534;font-size:15px}
.cmp td:nth-child(2){font-weight:700;color:#166534}
.winner{background:#dcfce7;border:2px solid #86efac;border-radius:14px;padding:16px 20px;font-size:18px;font-weight:700;color:#166534;text-align:center;margin-top:16px}
.cards li::before{background:#0ea5e9}.cards li{border-left-color:#0ea5e9}
.cta,.cta-large{background:linear-gradient(135deg,#0ea5e9,#10b981)}`;
    case "vsl":
      return `
*{color:inherit}body{background:#0a0f1e;color:#e2e8f0}
.topbar{background:#1e1b4b;color:#a5b4fc}
.hero{background:linear-gradient(135deg,#1e1b4b,#0a0f1e);padding:80px 20px}.hero .sub{color:#cbd5e1}
.band{background:#111827;border-bottom:1px solid #1f2937}.band.alt{background:#0f172a}
h2{color:#f1f5f9}.prose{color:#94a3b8}.lead{color:#cbd5e1;font-size:20px}
.cards li{background:#1f2937;border-color:#374151;color:#e2e8f0;border-left-color:#e11d48}
.cards li::before{background:#e11d48}
.pros li{background:#1f2937;border-color:#10b981;color:#6ee7b7}
.cons li{background:#1f2937;border-color:#f59e0b;color:#fcd34d}
.faq{background:#1f2937;border-color:#374151}.faq summary{color:#f1f5f9}.faq p{color:#94a3b8}
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
.band{background:#fff}.band.alt{background:#f1f5f9}`;
    case "native_ad":
      return `
body{font-family:'Georgia','Times New Roman',serif;background:#fff}
.topbar{background:#e63946;color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700}
.hero{background:#fff;color:#111;padding:44px 20px;border-bottom:3px solid #e63946}
.hero h1{font-family:Georgia,serif;color:#111;font-size:clamp(26px,4.5vw,44px);line-height:1.2}
.hero .sub{color:#555;font-family:Georgia,serif;font-style:italic;margin:12px auto 0;font-size:18px}
.hero .cta{display:none}.hero::before{background:none}
.band.alt{background:#f5f5f0}
h2{font-family:Georgia,serif;font-style:italic;text-align:left;border-bottom:1px solid #ddd;padding-bottom:10px}
.prose,.lead{font-family:Georgia,serif;font-size:18px;line-height:1.85;color:#222}
.cards li{border-left-color:#e63946;background:#fff8f8}.cards li::before{background:#e63946}
.cta,.cta-large{background:#e63946;box-shadow:0 8px 24px rgba(230,57,70,.3)}`;
    case "story":
      return `
.hero{background:linear-gradient(160deg,#1e1b4b,#312e81);padding:72px 20px}
.topbar{background:#312e81}.band.alt{background:#faf9ff}
.prose{font-size:17px;line-height:1.9;color:#1e1b4b}.lead{font-size:21px;color:#312e81;font-style:italic;font-weight:600}
h2{color:#1e1b4b}.cards li{border-left-color:#7c3aed;background:#f5f3ff}.cards li::before{background:#7c3aed}
.pros li{background:#ecfdf5;border-color:#10b981;color:#065f46}
.cta,.cta-large{background:linear-gradient(135deg,#7c3aed,#e11d48);box-shadow:0 10px 30px rgba(124,58,237,.35)}`;
    case "bridge_story":
      return `
body{background:#fdfcfa}
.topbar{background:#f1ede6;color:#78716c;font-weight:500;letter-spacing:.5px;text-transform:none;font-size:12px}
.hero{background:linear-gradient(160deg,#292524,#44403c);padding:64px 20px}
.hero h1{font-size:clamp(26px,4.5vw,42px)}
.hero .sub{color:#e7e5e4}
.hero .cta{display:none}
.band{background:#fdfcfa}.band.alt{background:#f7f5f0}
.prose{font-size:18px;line-height:1.9;color:#44403c;max-width:680px;margin:0 auto}
.lead{color:#44403c}
h2{color:#292524;text-align:center}
.cards{grid-template-columns:1fr;max-width:620px;margin:0 auto}
.cards li{border-left-color:#a16207;background:#fffdf7}.cards li::before{background:#a16207}
.finalcta{padding:36px 0}
.cta,.cta-large{background:#292524;box-shadow:0 10px 28px rgba(41,37,36,.3)}
.cta:hover{box-shadow:0 14px 34px rgba(41,37,36,.4)}
footer.aff-footer{background:#f7f5f0}`;
    case "listicle":
      return `
.hero{background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:72px 20px}
.topbar{background:#1e3a5f;letter-spacing:1px}.band.alt{background:#f8fafc}
.cards{grid-template-columns:1fr;counter-reset:item}
.cards li{border-left:none;border-top:4px solid var(--p);padding-left:20px;counter-increment:item;display:grid;grid-template-columns:40px 1fr;align-items:start;gap:12px}
.cards li::before{content:counter(item);width:36px;height:36px;font-size:16px;font-weight:800;background:linear-gradient(135deg,#0ea5e9,#6366f1)}
.pros{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.pros li{border-color:#0ea5e9;background:#eff6ff;color:#1e40af}
.cta,.cta-large{background:linear-gradient(135deg,#0ea5e9,#6366f1);box-shadow:0 10px 30px rgba(14,165,233,.35)}
h2{text-align:left;border-bottom:3px solid var(--p);padding-bottom:10px;display:inline-block}`;
    case "coupon":
      return `
.hero{background:linear-gradient(135deg,#059669,#047857)}
.topbar{background:#065f46;letter-spacing:1px}
.coupon-box{background:#fff;border:3px dashed #059669;border-radius:18px;padding:24px 28px;max-width:480px;margin:0 auto;text-align:center}
.coupon-label{color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.coupon-code{font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:4px;color:#059669;margin-bottom:12px;font-variant-numeric:tabular-nums}
.coupon-disc{color:#374151;font-size:14px;font-weight:600;margin-bottom:16px}
.copy-btn{background:#059669;color:#fff;border:none;border-radius:10px;padding:11px 22px;font-weight:700;cursor:pointer;font-size:14px;transition:background .15s}
.copy-btn:hover{background:#047857}
.timer-row{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;color:#6b7280;font-size:13px}
.timer-val{font-weight:700;color:#059669;font-variant-numeric:tabular-nums;font-size:15px}
.cards li::before{background:#059669}.cards li{border-left-color:#059669}
.cta,.cta-large{background:linear-gradient(135deg,#059669,#0ea5e9);box-shadow:0 10px 30px rgba(5,150,105,.35)}`;
    case "countdown":
      return `
.hero{background:linear-gradient(135deg,#dc2626,#b91c1c)}
.topbar{background:#991b1b;letter-spacing:1px}
.cblock{text-align:center;padding:8px 0}
.clabel{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px}
.cdisp{font-size:clamp(52px,10vw,80px);font-weight:800;color:var(--p);letter-spacing:6px;font-variant-numeric:tabular-nums;line-height:1}
.cmsg{color:var(--muted);font-size:14px;margin-top:10px}
.cards li::before{background:#dc2626}.cards li{border-left-color:#dc2626}
.cta,.cta-large{background:linear-gradient(135deg,#dc2626,#f59e0b);box-shadow:0 10px 30px rgba(220,38,38,.35)}
.hero .cta{background:rgba(255,255,255,.95);color:#dc2626}`;
    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main renderer
// ─────────────────────────────────────────────────────────────────────────────
export function renderPresellHtml(blocks: PresellBlocks, fallbackTitle: string, slug?: string): string {
  // Gate types: use specialized standalone renderer
  if ((GATE_TYPES as string[]).includes(blocks.type)) {
    return renderGateHtml(blocks, fallbackTitle);
  }

  // Privacy policy lives at /pre/<slug>/privacidade. When slug is known, use an
  // absolute path; otherwise fall back to a relative link (editor preview only).
  const privacyHref = slug ? `/pre/${esc(slug)}/privacidade` : "privacidade";

  const d = blocks.data;
  const aff = blocks.affiliate_url || "#";
  const theme = blocks.theme ?? DEFAULT_THEME;
  const order = (blocks.order ?? defaultOrderFor(blocks.type)) as PresellBlockKey[];
  const disclosure = blocks.disclosure_text || DEFAULT_DISCLOSURE;
  // Página oficial do produto: exibida como informação complementar discreta
  // (o link de afiliado continua sendo o CTA principal em todos os botões).
  const officialUrl = String(blocks.official_url ?? "").trim();
  let officialHost = "";
  if (officialUrl) {
    try { officialHost = new URL(officialUrl).hostname.replace(/^www\./, ""); } catch { officialHost = officialUrl; }
  }
  const sec: string[] = [];

  const ctaButton = (label: string, variant: "primary" | "large" = "primary") =>
    `<a class="cta cta-${variant}" data-cta="1" href="${esc(aff)}" target="_blank" rel="sponsored noopener noreferrer">${esc(label)} <span aria-hidden="true">→</span></a>`;

  let altBg = false;
  const section = (inner: string, opts: { wrap?: boolean; hero?: boolean } = {}) => {
    if (opts.hero) return `<header class="hero">${inner}</header>`;
    const bg = altBg ? "alt" : "";
    altBg = !altBg;
    return `<section class="band ${bg}"><div class="${opts.wrap === false ? "" : "wrap"}">${inner}</div></section>`;
  };

  for (const key of order) {
    const b: any = (d as any)[key];

    // Special case: countdown_timer
    if (key === "countdown_timer") {
      if (!b?.visible) continue;
      const mins = b.minutes ?? 15;
      sec.push(section(
        `<div class="cblock">
<p class="clabel">${esc(b.message ?? "⏰ Oferta por tempo limitado!")}</p>
<div class="cdisp" id="cdisp">${String(mins).padStart(2,"0")}:00</div>
</div>
<script>
(function(){var e=Date.now()+${mins}*60000;function u(){var d=Math.max(0,e-Date.now()),m=Math.floor(d/60000),s=Math.floor((d%60000)/1000),el=document.getElementById('cdisp');if(el)el.textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);if(d>0)setTimeout(u,500);}u();})();
</script>`
      ));
      continue;
    }

    // Special case: coupon_widget
    if (key === "coupon_widget") {
      if (!b?.visible) continue;
      const code = b.code ?? "PROMO10";
      const disc = b.discount_pct ?? "Desconto especial";
      const expMins = b.expires_minutes ?? 20;
      sec.push(section(
        `<div class="coupon-box">
<p class="coupon-label">🎟️ Seu cupom de desconto</p>
<div class="coupon-code" id="cpcode">${esc(code)}</div>
<p class="coupon-disc">${esc(disc)}</p>
<button class="copy-btn" onclick="navigator.clipboard.writeText('${esc(code)}').then(()=>{this.textContent='✓ Copiado!'})">Copiar cupom</button>
<div class="timer-row">⏰ Expira em: <span class="timer-val" id="couponTimer">${String(expMins).padStart(2,"0")}:00</span></div>
</div>
<script>
(function(){var e=Date.now()+${expMins}*60000;function u(){var d=Math.max(0,e-Date.now()),m=Math.floor(d/60000),s=Math.floor((d%60000)/1000),el=document.getElementById('couponTimer');if(el)el.textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);if(d>0)setTimeout(u,500);}u();})();
</script>`
      ));
      continue;
    }

    if (!b || b.visible === false) continue;
    switch (key) {
      case "topbar":
        if (b.text) sec.push(`<div class="topbar">${esc(b.text)}</div>`);
        break;
      case "urgency_bar":
        if (b.text) sec.push(`<div class="urgbar">${esc(b.text)}</div>`);
        break;
      case "viewers_counter": {
        const min = Math.max(1, Number(b.min) || 34);
        const max = Math.max(min + 1, Number(b.max) || 97);
        sec.push(`<div class="viewers-wrap"><div class="viewers"><span class="vdot"></span><span id="vcount">${min}</span>&nbsp;pessoas estão vendo esta página agora</div></div>
<script>
(function(){var mn=${min},mx=${max},el=document.getElementById('vcount');if(!el)return;
function r(){return Math.floor(mn+Math.random()*(mx-mn+1));}
el.textContent=r();setInterval(function(){el.textContent=r();},7000+Math.random()*6000);})();
</script>`);
        break;
      }
      case "author_byline": {
        const name = b.name || "Redação";
        const date = b.date || new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
        sec.push(`<div class="byline-wrap"><div class="wrap byline">
  <div class="byline-av">${esc(String(name).trim().charAt(0).toUpperCase() || "R")}</div>
  <div class="byline-info"><strong>Por ${esc(name)}</strong>${b.role ? `<span class="byline-role"> · ${esc(b.role)}</span>` : ""}<div class="byline-date">Publicado em ${esc(date)}</div></div>
</div></div>`);
        break;
      }
      case "testimonials":
        if (b.items?.length)
          sec.push(section(
            `<h2>${esc(b.title || "O que estão dizendo")}</h2><div class="testis">${b.items
              .map((t: any) => `<blockquote>${t.stars ? `<div class="t-stars">${"⭐".repeat(Math.min(5, Math.max(1, Number(t.stars) || 5)))}</div>` : ""}<p>"${esc(t.text)}"</p><cite>— ${esc(t.name)}</cite></blockquote>`)
              .join("")}</div>`
          ));
        break;
      case "comments":
        if (b.items?.length)
          sec.push(section(
            `<h3 class="fbc-title">${esc(b.title || "Comentários")} <span class="fbc-count">(${b.items.length})</span></h3>
<div class="fbcomments">${b.items.map((c: any) => {
              const initial = esc(String(c.name ?? "?").trim().charAt(0).toUpperCase() || "?");
              const hue = Math.abs(String(c.name ?? "").split("").reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0)) % 360;
              return `<div class="fbc">
  <div class="fbc-av" style="background:hsl(${hue},55%,45%)">${initial}</div>
  <div class="fbc-body">
    <div class="fbc-bubble"><strong>${esc(c.name)}</strong><p>${esc(c.text)}</p></div>
    <div class="fbc-meta">Curtir · Responder${c.time ? ` · ${esc(c.time)}` : ""}${Number(c.likes) > 0 ? ` · <span class="fbc-likes">👍 ${Number(c.likes)}</span>` : ""}</div>
  </div>
</div>`;
            }).join("")}</div>
<p class="fbc-note">Comentários ilustrativos.</p>`
          ));
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
        if (b.text) sec.push(section(`<div class="lead">${proseHtml(b.text)}</div>`));
        break;
      case "what_is":
      case "story":
      case "how_it_works":
        if (b.text)
          sec.push(section(`<h2>${esc(b.title)}</h2><div class="prose">${proseHtml(b.text)}</div>`));
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
        const qs = b.questions || [];
        if (!qs.length) break;
        // Quiz interativo: uma pergunta por vez; ao final revela a "solução
        // recomendada" com CTA. Toda opção avança (segmenta e engaja).
        const steps = qs.map((q: any, i: number) =>
          `<div class="qstep" data-qs="${i}"${i ? ` style="display:none"` : ""}>
  <h3>${esc(q.question)}</h3>
  <div class="qopts">${(q.options || []).map((o: string) => `<button type="button" class="qopt" data-next="${i + 1}">${esc(o)}</button>`).join("")}</div>
</div>`).join("");
        sec.push(section(
          `<h2>${esc(b.title)}</h2>
<div class="quizbox" id="quizbox">
  <div class="qprog" id="qprog">Pergunta 1 de ${qs.length}</div>
  ${steps}
  <div class="qresult" id="qresult" style="display:none">
    <div class="qresult-badge">✓ Análise concluída</div>
    ${b.result ? `<p class="qresult-text">${esc(b.result)}</p>` : ""}
    <a class="cta" data-cta="1" href="${esc(aff)}" target="_blank" rel="sponsored noopener noreferrer">${esc(d.cta?.text || "Ver a solução recomendada")} →</a>
  </div>
</div>
<script>
(function(){var box=document.getElementById('quizbox');if(!box)return;var total=${qs.length};
box.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('.qopt'):null;if(!t)return;
t.classList.add('qsel');var n=parseInt(t.getAttribute('data-next'),10);
setTimeout(function(){var cur=t.closest('.qstep');if(cur)cur.style.display='none';
var prog=document.getElementById('qprog');
if(n>=total){var res=document.getElementById('qresult');if(res)res.style.display='block';if(prog)prog.style.display='none';}
else{var nx=box.querySelector('[data-qs="'+n+'"]');if(nx)nx.style.display='block';if(prog)prog.textContent='Pergunta '+(n+1)+' de '+total;}},280);});})();
</script>`
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
        // Cookie notice is rendered as an overlay popup (see below), skip inline section
        break;
      case "faq":
        if (b.items?.length) sec.push(section(
          `<h2>${esc(b.title)}</h2>${b.items.map((it: any) =>
            `<details class="faq"><summary>${esc(it.q)}</summary><p>${esc(it.a)}</p></details>`).join("")}`
        ));
        break;
      case "cta":
        sec.push(section(
          `<div class="finalcta">${ctaButton(b.text || "Acessar site oficial", "large")}
<div class="cta-extras"><button type="button" class="copylink-btn" data-copy-aff="1">🔗 Copiar link</button></div>
${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}
${officialUrl ? `<p class="official-link">Prefere pesquisar antes? <a href="${esc(officialUrl)}" target="_blank" rel="noopener nofollow">Visite a página oficial do produto</a></p>` : ""}</div>`
        ));
        break;
    }
  }

  const stickyCta = d.cta?.sticky !== false
    ? `<div class="sticky-cta"><a class="cta cta-sticky" data-cta="1" href="${esc(aff)}" target="_blank" rel="sponsored noopener noreferrer">${esc(d.cta?.text || "Acessar site oficial")}</a></div>`
    : "";

  // Cookie notice: rendered as overlay popup (appears on page load)
  const cookieNotice = d.cookie_notice;
  const cookieOverlay = cookieNotice?.visible && cookieNotice?.text
    ? `<div id="ckOverlay" style="position:fixed;inset:0;background:rgba(15,23,42,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
  <div style="background:#fff;border-radius:22px;padding:clamp(24px,4vw,36px);max-width:460px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:ckIn .25s ease">
    <div style="font-size:38px;margin-bottom:14px">🍪</div>
    <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:700;color:#0f172a;margin-bottom:10px;line-height:1.3">Aviso de redirecionamento</h3>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin-bottom:22px">${esc(cookieNotice.text)}</p>
    <a href="${esc(aff)}" target="_blank" rel="sponsored noopener noreferrer" data-cta="1"
       style="display:block;background:linear-gradient(135deg,${theme.primary},${theme.accent});color:#fff;font-weight:700;font-size:16px;padding:16px 24px;border-radius:12px;text-decoration:none;margin-bottom:10px;box-shadow:0 8px 24px rgba(99,102,241,.3)">
      ✓ Entendi, continuar →
    </a>
    <button onclick="document.getElementById('ckOverlay').style.display='none'"
       style="background:none;border:1px solid #e2e8f0;color:#64748b;padding:10px 20px;border-radius:10px;cursor:pointer;font-size:14px;width:100%;transition:background .15s"
       onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
      Não, voltar
    </button>
    <p style="color:#94a3b8;font-size:11px;margin-top:14px;line-height:1.6">Esta página pode conter links de afiliado.</p>
  </div>
</div>
<style>@keyframes ckIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}</style>`
    : "";

  // WhatsApp floating button (shown on all pages if configured)
  const wa = d.whatsapp_button;
  const waHtml = wa?.visible && wa?.phone
    ? `<a href="https://wa.me/${esc(wa.phone.replace(/\D/g, ""))}?text=${encodeURIComponent(wa.message || "Olá!")}"
         target="_blank" rel="noopener noreferrer"
         title="Falar no WhatsApp"
         style="position:fixed;bottom:24px;right:24px;z-index:9998;width:56px;height:56px;border-radius:50%;background:${esc(wa.color || "#25d366")};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(37,211,102,.5);text-decoration:none;transition:transform .15s"
         onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
       <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
     </a>`
    : "";

  // Pixels (instalação padrão apenas — sem eventos customizados)
  const sanitizeId = (s: string) => String(s ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  const fbId = sanitizeId(blocks.pixels?.facebook ?? "");
  const gId = sanitizeId(blocks.pixels?.google ?? "");
  const pixelsHtml = `${fbId ? `
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbId}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${fbId}&ev=PageView&noscript=1"/></noscript>` : ""}${gId ? `
<script async src="https://www.googletagmanager.com/gtag/js?id=${gId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gId}');</script>` : ""}`;

  // Botão "Copiar link": copia o link de afiliado com feedback "✓ Copiado!".
  // Delegação global (um script para todos os botões data-copy-aff) — evita
  // problemas de aspas/escape que um onclick inline com a URL teria.
  const affJs = JSON.stringify(aff).replace(/</g, "\\u003c");
  const copyLinkScript = `<script>
document.addEventListener('click',function(e){
var t=e.target&&e.target.closest?e.target.closest('[data-copy-aff]'):null;if(!t||t.dataset.copying)return;
var url=${affJs};
function done(){t.dataset.copying='1';var old=t.textContent;t.textContent='\\u2713 Copiado!';t.classList.add('copied');
setTimeout(function(){t.textContent=old;t.classList.remove('copied');delete t.dataset.copying;},2000);}
function fallback(){var ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';
document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(err){/* noop */}document.body.removeChild(ta);}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(done).catch(fallback);}else{fallback();}
});
</script>`;

  // CTA com delay configurável (ex.: VSL — botão aparece após N segundos)
  const ctaDelay = Math.max(0, Number(d.cta?.reveal_after_seconds) || 0);
  const ctaDelayHtml = ctaDelay > 0
    ? `<style>body.cta-hidden .finalcta,body.cta-hidden .sticky-cta,body.cta-hidden .hero .cta{display:none!important}</style>
<script>document.body.classList.add('cta-hidden');setTimeout(function(){document.body.classList.remove('cta-hidden');},${ctaDelay * 1000});</script>`
    : "";

  const hasIllustrative =
    (d.testimonials?.visible && (d.testimonials?.items?.length ?? 0) > 0) ||
    (d.comments?.visible && (d.comments?.items?.length ?? 0) > 0);

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(d.headline?.title || fallbackTitle)}</title>
<meta name="description" content="${esc(d.headline?.subtitle || "")}" />
<meta name="robots" content="index,follow" />${pixelsHtml}
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
.band{padding:48px 20px}.band.alt{background:var(--surface)}
.wrap{max-width:880px;margin:0 auto}
h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(24px,3.4vw,34px);margin-bottom:22px;letter-spacing:-.015em;line-height:1.2}
.prose{font-size:17px;color:#334155;max-width:760px;line-height:1.8}
.prose p{margin-bottom:16px}.prose p:last-child{margin-bottom:0}
.lead{font-size:20px;color:#334155;font-weight:500;text-align:center;max-width:720px;margin:0 auto}
.lead p{margin-bottom:14px}.lead p:last-child{margin-bottom:0}
.figure{margin:0 auto;max-width:560px;text-align:center}
.media{border-radius:18px;box-shadow:0 12px 40px rgba(15,23,42,.12);margin:0 auto}
figcaption{margin-top:10px;font-size:13px;color:var(--muted)}
.rating{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px}
.stars{font-size:32px;color:#f59e0b;letter-spacing:4px}
.rscore{font-size:22px;font-weight:700}.rlabel{color:var(--muted);font-size:14px}
.cards{list-style:none;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.cards li{background:#fff;border:1px solid var(--border);padding:18px 20px;border-radius:14px;font-weight:500;position:relative;padding-left:48px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.cards li::before{content:"✓";position:absolute;left:16px;top:18px;width:24px;height:24px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.pros,.cons{list-style:none;display:grid;gap:10px}
.pros li,.cons li{background:#fff;border-left:4px solid;padding:14px 18px;border-radius:10px;font-weight:500}
.pros li{border-color:#10b981;background:#ecfdf5}.cons li{border-color:#f59e0b;background:#fffbeb}
.badges{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.badge{background:#fff;border:1px solid var(--border);padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600;color:#0f172a}
.tablewrap{overflow-x:auto}
.cmp{width:100%;border-collapse:collapse;min-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid var(--border)}
.cmp th,.cmp td{padding:14px 16px;border-bottom:1px solid var(--border);text-align:left}
.cmp th{background:var(--surface2);font-weight:700;color:#0f172a}.cmp td:first-child{font-weight:600}
.winner{margin-top:14px;font-size:16px;color:#065f46}
.q{background:#fff;border:1px solid var(--border);padding:18px 20px;border-radius:12px;margin-bottom:12px}
.q ul{margin-top:10px;padding-left:22px;color:#334155}
.result{background:#ecfdf5;border:1px solid #10b981;padding:16px 18px;border-radius:12px;margin-top:14px;font-size:16px}
.video{width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.12);background:#000}
.video iframe{width:100%;height:100%;border:0}
.notice{background:#fef3c7;border:1px solid #f59e0b;color:#78350f;padding:16px 20px;border-radius:12px;font-size:15px;text-align:center;max-width:720px;margin:0 auto}
.faq{background:#fff;border:1px solid var(--border);padding:16px 20px;border-radius:12px;margin-bottom:10px;cursor:pointer}
.faq summary{font-weight:600;font-size:16px;list-style:none;display:flex;justify-content:space-between;align-items:center}
.faq summary::after{content:"+";font-size:22px;font-weight:300;color:var(--p)}.faq[open] summary::after{content:"−"}
.faq p{margin-top:12px;color:#334155}
.finalcta{text-align:center;padding:20px 0}.note{margin-top:14px;color:var(--muted);font-size:13px}
.cta-extras{margin-top:14px}
.copylink-btn{background:none;border:1px solid var(--border);color:var(--muted);padding:9px 20px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
.copylink-btn:hover{border-color:var(--p);color:var(--p)}
.copylink-btn.copied{border-color:#10b981;color:#065f46;background:#ecfdf5}
.official-link{margin-top:10px;font-size:13px;color:var(--muted)}
.official-link a{color:inherit;text-decoration:underline}
.cta{display:inline-block;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;font-weight:700;padding:18px 36px;border-radius:14px;text-decoration:none;box-shadow:0 10px 30px rgba(99,102,241,.35);transition:transform .15s ease,box-shadow .15s ease;font-size:17px}
.cta:hover{transform:translateY(-1px);box-shadow:0 14px 36px rgba(99,102,241,.45)}
.cta-large{padding:20px 44px;font-size:18px;margin-top:28px}
.hero .cta{background:#fff;color:var(--p)}.hero .cta:hover{box-shadow:0 14px 36px rgba(0,0,0,.2)}
.sticky-cta{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--border);padding:12px 16px;z-index:50;display:flex;justify-content:center}
.sticky-cta .cta{width:100%;max-width:520px;text-align:center;padding:16px;border-radius:12px;font-size:16px}
@media (min-width:768px){.sticky-cta{display:none}body{padding-bottom:0}}
footer.aff-footer{padding:32px 20px 24px;text-align:center;color:var(--muted);font-size:12px;border-top:1px solid var(--border);background:var(--surface)}
footer.aff-footer .disclosure{max-width:720px;margin:0 auto 8px;font-size:13px}
footer.aff-footer .foot-note{max-width:720px;margin:0 auto 6px;font-size:11px;opacity:.85}
.urgbar{background:linear-gradient(90deg,#b91c1c,#dc2626);color:#fff;text-align:center;font-size:14px;font-weight:700;padding:10px 16px;position:sticky;top:0;z-index:60;letter-spacing:.2px}
.viewers-wrap{display:flex;justify-content:center;padding:14px 16px 0}
.viewers{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;color:#334155;box-shadow:0 2px 10px rgba(0,0,0,.06)}
.vdot{width:9px;height:9px;border-radius:50%;background:#22c55e;animation:vpulse 1.6s infinite}
@keyframes vpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}
.byline-wrap{background:var(--bg);border-bottom:1px solid var(--border)}
.byline{display:flex;align-items:center;gap:12px;padding:14px 20px}
.byline-av{width:42px;height:42px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0}
.byline-info{font-size:14px;color:#334155}
.byline-role{color:var(--muted);font-weight:400}
.byline-date{font-size:12px;color:var(--muted)}
.testis{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.testis blockquote{background:#fff;border:1px solid var(--border);padding:20px;border-radius:14px;border-left:4px solid var(--p)}
.testis cite{display:block;margin-top:10px;font-weight:600;color:var(--muted);font-style:normal;font-size:14px}
.t-stars{font-size:15px;margin-bottom:8px}
.fbc-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;margin-bottom:16px}
.fbc-count{color:var(--muted);font-weight:400;font-size:15px}
.fbcomments{display:grid;gap:14px;max-width:680px}
.fbc{display:flex;gap:10px;align-items:flex-start}
.fbc-av{width:38px;height:38px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
.fbc-bubble{background:var(--surface2);border-radius:16px;padding:10px 14px}
.fbc-bubble strong{font-size:13.5px;display:block;margin-bottom:2px}
.fbc-bubble p{font-size:14px;color:#334155;line-height:1.5}
.fbc-meta{font-size:12px;color:var(--muted);margin-top:5px;padding-left:8px}
.fbc-likes{background:#fff;border:1px solid var(--border);border-radius:999px;padding:1px 8px;font-size:11px}
.fbc-note{font-size:11px;color:var(--muted);margin-top:12px;font-style:italic}
.quizbox{max-width:640px;margin:0 auto}
.qprog{text-align:center;font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px}
.qstep h3{font-size:20px;margin-bottom:16px;text-align:center;font-family:'Plus Jakarta Sans',sans-serif}
.qopts{display:grid;gap:10px}
.qopt{background:#fff;border:2px solid var(--border);border-radius:14px;padding:16px 20px;font-size:16px;font-weight:500;text-align:left;cursor:pointer;transition:all .15s;font-family:inherit;color:var(--fg)}
.qopt:hover{border-color:var(--p);background:color-mix(in srgb,var(--p) 6%,#fff)}
.qopt.qsel{border-color:var(--p);background:color-mix(in srgb,var(--p) 12%,#fff)}
.qresult{text-align:center;padding:8px 0}
.qresult-badge{display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #10b981;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;margin-bottom:14px}
.qresult-text{font-size:17px;margin-bottom:8px;line-height:1.7}
${typeStyles(blocks.type)}
</style></head>
<body>
${sec.join("\n")}
<footer class="aff-footer">
<p class="disclosure">${esc(disclosure)}</p>
${hasIllustrative ? `<p class="foot-note">Os depoimentos e comentários exibidos nesta página são conteúdo ilustrativo.</p>` : ""}
<p class="foot-note">Resultados podem variar de pessoa para pessoa. Nenhum resultado específico é garantido.</p>
${officialUrl ? `<p class="foot-note">Página oficial do produto: <a href="${esc(officialUrl)}" target="_blank" rel="noopener nofollow" style="color:inherit;text-decoration:underline">${esc(officialHost)}</a></p>` : ""}
<p>© ${new Date().getFullYear()}. Conteúdo independente. · <a href="${privacyHref}" style="color:inherit;text-decoration:underline">Política de Privacidade</a></p>
</footer>
${stickyCta}
${cookieOverlay}
${waHtml}
${copyLinkScript}
${ctaDelayHtml}
</body></html>`;
}
