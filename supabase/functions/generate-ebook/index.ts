// Edge Function: generate-ebook
// Cria o registro do ebook em "processing", debita 1 crédito,
// e processa a geração em background (EdgeRuntime.waitUntil) para não estourar timeout.
// Geração em 2 fases: (1) esqueleto profissional (título, capa, sumário, plano de
// capítulos), (2) cada capítulo em chamada separada com retry e progresso parcial
// salvo no Supabase — se uma chamada falhar, nada do que já foi gerado se perde.
// O frontend faz polling em ebooks.status e ebooks.content.progress.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";
import { jsonrepair } from "https://esm.sh/jsonrepair@3.6.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) {
    c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  // Trim to outermost { ... } if there's extra prose before or after
  const first = c.indexOf("{");
  const last = c.lastIndexOf("}");
  if (first >= 0 && last > first) c = c.slice(first, last + 1);
  return c;
}

// Sanitiza JSON vindo de LLMs: escapa caracteres de controle crus
// dentro de strings e neutraliza barras invertidas inválidas.
function sanitizeLlmJson(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      if (inStr) {
        const next = s[i + 1] ?? "";
        if (!'"\\/bfnrtu'.includes(next)) {
          out += "\\\\";
          continue;
        }
      }
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (inStr) {
      const code = ch.charCodeAt(0);
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      if (code < 0x20) {
        out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function parseLoose(raw: string): any {
  const cleaned = stripFences(raw);
  try { return JSON.parse(cleaned); } catch (_) { /* continua */ }
  try { return JSON.parse(sanitizeLlmJson(cleaned)); } catch (_) { /* continua */ }
  try { return JSON.parse(jsonrepair(cleaned)); } catch (_) { /* continua */ }
  try { return JSON.parse(jsonrepair(sanitizeLlmJson(cleaned))); } catch (e) {
    const msg = (e as Error).message;
    const pos = Number(msg.match(/position (\d+)/)?.[1] ?? -1);
    const ctx = pos >= 0 ? cleaned.slice(Math.max(0, pos - 80), pos + 80) : cleaned.slice(0, 200);
    throw new Error(`JSON inválido da IA após reparos: ${msg}. Contexto: …${ctx}…`);
  }
}

const SYSTEM_JSON =
  "Você é um escritor profissional de ebooks best-sellers. REGRA ABSOLUTA: responda APENAS com um objeto JSON válido. Nenhum texto antes, nenhum texto depois, nenhuma cerca de código (```). Dentro de strings JSON use \\n para quebrar linhas, nunca quebre linhas literais dentro de strings.";

// Regras de qualidade de texto aplicadas a todas as chamadas
function qualityRules(idioma: string): string {
  return `QUALIDADE DO TEXTO (OBRIGATÓRIO):
- Escreva em ${idioma || "Português brasileiro"} natural e fluido, tom conversacional — como quem explica para um amigo inteligente.
- Frases curtas. Parágrafos de 2 a 4 frases. Nada de blocos gigantes de texto.
- PROIBIDO usar clichês de IA como: "no mundo de hoje", "é importante ressaltar", "em resumo", "nos dias atuais", "cada vez mais", "não é segredo para ninguém", "vale destacar".
- Use analogias do dia a dia e números/dados concretos quando fizer o texto mais convincente.
- Exemplos práticos com contexto brasileiro (situações, nomes e realidades do Brasil) quando o idioma for português.`;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function wordCount(s: unknown): number {
  return String(s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

// Piso de aceitação de um capítulo. O prompt pede 900-1300 palavras; abaixo
// disto o conteúdo veio truncado/raso e é tratado como falha (gera retry).
const MIN_CHAPTER_WORDS = 300;

function validateChapter(p: any): string | null {
  const wc = wordCount(p?.content);
  if (wc < MIN_CHAPTER_WORDS) return `capítulo veio com ${wc} palavras (mínimo ${MIN_CHAPTER_WORDS})`;
  return null;
}

function validateOutline(p: any): string | null {
  if (!String(p?.title ?? "").trim()) return "esqueleto sem título";
  if (!Array.isArray(p?.chapters) || p.chapters.length === 0) return "esqueleto sem capítulos";
  const bad = p.chapters.findIndex((c: any) =>
    !String(c?.title ?? "").trim() || !Array.isArray(c?.sections) || c.sections.length === 0);
  if (bad >= 0) return `capítulo ${bad + 1} do esqueleto sem título ou sem seções`;
  if (wordCount(p?.introduction) < 40) return `introdução com apenas ${wordCount(p?.introduction)} palavras`;
  return null;
}

// Chamada com retry automático. Rate limit (429) espera MUITO mais — a cota
// free tier renova por minuto; esperar 1,5s era inútil e derrubava capítulos.
// deadline: timestamp máximo para não estourar o tempo da edge function.
// validate: conteúdo que parseia mas vem vazio/raso também conta como falha.
async function callAIWithRetry(prompt: string, maxTokens: number, tries = 3, deadline = Infinity, validate?: (parsed: any) => string | null): Promise<any> {
  let lastErr: Error | null = null;
  for (let i = 0; i < tries; i++) {
    // Orçamento por TENTATIVA: uma chamada em voo não é interrompida pelo
    // deadline, então cada uma ganha um teto duro — sem isso, um provedor
    // pendurado leva a function inteira ao wall clock (~400s) e o ebook
    // morre órfão em "processing" (aconteceu 3x em produção).
    const remaining = deadline - Date.now();
    if (remaining < 20_000) {
      console.warn("[generate-ebook] sem orçamento para nova tentativa de IA — abortando");
      break;
    }
    const callCap = Math.min(110_000, remaining - 10_000);
    try {
      const content = await Promise.race([
        chatCompletion([
          { role: "system", content: SYSTEM_JSON },
          { role: "user", content: prompt },
        ], maxTokens),
        sleep(callCap).then(() => {
          throw new Error(`chamada de IA excedeu ${Math.round(callCap / 1000)}s (teto de orçamento)`);
        }),
      ]);
      if (!content) throw new Error("Resposta vazia da IA");
      const parsed = parseLoose(content);
      const problem = validate?.(parsed);
      if (problem) throw new Error(`Conteúdo reprovado na validação: ${problem}`);
      return parsed;
    } catch (e) {
      lastErr = e as Error;
      const is429 = /429|quota|rate.?limit|resource.?exhausted/i.test(lastErr.message);
      console.warn(`[generate-ebook] tentativa ${i + 1}/${tries} falhou${is429 ? " (rate limit)" : ""}: ${lastErr.message.slice(0, 200)}`);
      if (i < tries - 1) {
        const wait = is429 ? 30_000 * (i + 1) : 1500 * (i + 1);
        if (Date.now() + wait > deadline) {
          console.warn("[generate-ebook] deadline próximo — abortando novas tentativas");
          break;
        }
        await sleep(wait);
      }
    }
  }
  throw lastErr ?? new Error("Falha na IA");
}

// ── Ilustrações via Gemini (imagem) ─────────────────────────────────────────
// Paleta espelhada de src/lib/ebook-art.ts: dá consistência visual entre a
// arte programática (capa/banners SVG) e as ilustrações geradas por IA.
const ART_PALETTES = [
  { name: "indigo", from: "#4f46e5", to: "#7c3aed", accent: "#fbbf24" },
  { name: "ocean", from: "#0369a1", to: "#0891b2", accent: "#fde047" },
  { name: "emerald", from: "#047857", to: "#0d9488", accent: "#fef08a" },
  { name: "sunset", from: "#b91c1c", to: "#ea580c", accent: "#fef9c3" },
  { name: "royal", from: "#1e3a8a", to: "#6d28d9", accent: "#f472b6" },
  { name: "wine", from: "#831843", to: "#be185d", accent: "#fbbf24" },
  { name: "forest", from: "#14532d", to: "#3f6212", accent: "#fde68a" },
  { name: "slate", from: "#0f172a", to: "#334155", accent: "#38bdf8" },
];
function paletteFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ART_PALETTES[Math.abs(h) % ART_PALETTES.length];
}

const IMAGE_MODELS = ["gemini-2.5-flash-image"];

// Com billing ativo na conta Google, imagens do Gemini são COBRADAS
// (~US$ 0,039/imagem ≈ R$ 1,70 por ebook de 8 imagens), enquanto o texto sai
// por centavos. Para não gerar surpresa de custo, imagens Gemini ficam
// desligadas por padrão (Pollinations gratuito cobre) e só ligam com o
// secret GEMINI_PAID_IMAGES=on no Supabase.
function geminiImagesEnabled(): boolean {
  return (Deno.env.get("GEMINI_PAID_IMAGES") ?? "").toLowerCase() === "on";
}

// Fallback SEM chave: Pollinations.ai (gratuito). Limita requisições
// concorrentes, então: retry em 429 com espera (a fila sequencial abaixo já
// evita paralelismo).
async function generatePollinationsImage(prompt: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 75_000);
      const seed = Math.floor(Math.random() * 1_000_000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=1216&height=832&nologo=true&seed=${seed}`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      if (!mime.startsWith("image/")) throw new Error(`tipo inesperado: ${mime}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 5_000) throw new Error("imagem muito pequena (provável erro)");
      return { bytes, mime };
    } catch (e) {
      const msg = (e as Error).message;
      console.warn(`[generate-ebook] Pollinations tentativa ${attempt + 1}/3 falhou: ${msg}`);
      if (attempt < 2) await sleep(msg.includes("429") ? 15_000 : 5_000);
    }
  }
  return null;
}

// Estado do run: depois do primeiro 429 do Gemini imagem, para de tentar —
// cada tentativa perdida consome a MESMA cota free tier que o texto usa.
type ImgState = { geminiBlocked: boolean };

// Gera uma ilustração e retorna os bytes PNG/JPEG, ou null em falha (nunca lança)
// Ordem: Gemini (se houver cota de imagem) → Pollinations (gratuito, sem chave)
async function generateIllustration(geminiKey: string, prompt: string, state: ImgState): Promise<{ bytes: Uint8Array; mime: string } | null> {
  for (const model of geminiKey && geminiImagesEnabled() && !state.geminiBlocked ? IMAGE_MODELS : []) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45_000);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
          signal: ctrl.signal,
        },
      );
      clearTimeout(t);
      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`HTTP ${res.status}: ${errTxt.slice(0, 160)}`);
      }
      const j = await res.json();
      const part = (j.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data);
      if (!part) throw new Error("resposta sem imagem");
      const b64 = String(part.inlineData.data);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return { bytes, mime: String(part.inlineData.mimeType || "image/png") };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("429")) {
        state.geminiBlocked = true;
        console.warn(`[generate-ebook] Gemini imagem sem cota (429) — usando só Pollinations neste run para poupar a cota de texto`);
      } else {
        console.warn(`[generate-ebook] modelo de imagem ${model} falhou: ${msg}`);
      }
    }
  }
  return await generatePollinationsImage(prompt);
}

function illustrationPrompt(desc: string, tema: string, paletteName: string): string {
  // Em inglês: modelos de imagem (Gemini e Flux/Pollinations) seguem melhor.
  // A cena (desc) vem em português da IA de texto e é compreendida normalmente.
  return `Professional modern flat editorial illustration for a book about "${tema}".
Scene: ${desc}.
Predominant color palette: ${paletteName} tones.
STRICT RULES: absolutely no text, no letters, no numbers, no watermark, no logo in the image. Clean composition, premium book aesthetic, landscape 3:2.`;
}

// Gera + faz upload; retorna URL pública ou null (nunca lança)
async function makeIllustration(opts: {
  admin: ReturnType<typeof createClient>;
  geminiKey: string;
  path: string;
  desc: string;
  tema: string;
  paletteName: string;
  label: string;
  state?: ImgState;
}): Promise<string | null> {
  const { admin, geminiKey, path, desc, tema, paletteName, label } = opts;
  const state = opts.state ?? { geminiBlocked: false };
  try {
    console.log(`[generate-ebook] Gerando ilustração ${label}...`);
    const img = await generateIllustration(geminiKey, illustrationPrompt(desc, tema, paletteName), state);
    if (!img) {
      console.warn(`[generate-ebook] Erro ao gerar imagem ${label}, pulando...`);
      return null;
    }
    const ext = img.mime.includes("jpeg") ? "jpg" : "png";
    const fullPath = `${path}.${ext}`;
    const { error: upErr } = await admin.storage.from("ebook-assets")
      .upload(fullPath, new Blob([img.bytes], { type: img.mime }), { contentType: img.mime, upsert: true });
    if (upErr) {
      console.warn(`[generate-ebook] Upload da imagem ${label} falhou (${upErr.message}), pulando...`);
      return null;
    }
    const { data: pub } = admin.storage.from("ebook-assets").getPublicUrl(fullPath);
    console.log(`[generate-ebook] Ilustração ${label} pronta: ${pub.publicUrl}`);
    return pub.publicUrl;
  } catch (e) {
    console.warn(`[generate-ebook] Erro ao gerar imagem ${label}, pulando... (${(e as Error).message})`);
    return null;
  }
}

type OutlineChapter = { title: string; sections: string[]; image_description: string };
type Outline = {
  title: string;
  subtitle: string;
  cover_promise: string;
  introduction: string;
  chapters: OutlineChapter[];
  conclusion: string;
  call_to_action: string;
  bonus: string[];
};

function outlinePrompt(briefing: any, chapters: number): string {
  return `Planeje um ebook PROFISSIONAL no idioma "${briefing.idioma || "Português"}", tom "${briefing.tom_voz || "profissional e acessível"}".

BRIEFING:
- Tema/Nicho: ${briefing.tema}
- Público-alvo: ${briefing.publico_alvo}
- Promessa principal: ${briefing.promessa || "transformar a vida do leitor"}
- Problema que resolve: ${briefing.problema || "dificuldades na área"}
- Autor: ${briefing.autor || "(não informado)"}
- Uso: ${briefing.uso || "venda"}
- Número de capítulos: EXATAMENTE ${chapters}

ESTRUTURA DO PLANO (progressão lógica obrigatória):
Os capítulos devem seguir o arco: PROBLEMA (situação atual e dores) → AGITAÇÃO (por que continua dando errado) → MÉTODO (o caminho/solução passo a passo) → APLICAÇÃO PRÁTICA (implementação, casos, manutenção de resultados).

${qualityRules(briefing.idioma)}

CAMPOS:
- title: título criativo e vendedor do ebook
- subtitle: subtítulo que detalha a promessa
- cover_promise: 1 frase curta de promessa forte para a capa (máx 14 palavras)
- introduction: introdução com GANCHO EMOCIONAL — comece com uma cena, pergunta ou dor real do leitor; 3-4 parágrafos separados por \\n\\n; termine dizendo o que o leitor vai conquistar
- chapters: EXATAMENTE ${chapters} objetos, cada um com:
  - title: título específico e curioso do capítulo
  - sections: 3 a 5 subtítulos das seções internas do capítulo
  - image_description: descrição de 1 imagem ilustrativa para o capítulo (1 frase, ex: "Mulher sorrindo preparando refeição saudável na cozinha")
- conclusion: 2-3 parágrafos amarrando a transformação prometida
- call_to_action: 1 parágrafo persuasivo convidando para ${briefing.uso === "gratuito" ? "o próximo passo com o autor" : "conhecer a oferta do autor"}
- bonus: 2 a 4 ideias de bônus acionáveis

Retorne APENAS o JSON:
{
  "title": string,
  "subtitle": string,
  "cover_promise": string,
  "introduction": string,
  "chapters": [{ "title": string, "sections": string[], "image_description": string }],
  "conclusion": string,
  "call_to_action": string,
  "bonus": string[]
}`;
}

function chapterPrompt(briefing: any, outline: Outline, idx: number): string {
  const ch = outline.chapters[idx];
  const prevTitles = outline.chapters.slice(0, idx).map((c, i) => `${i + 1}. ${c.title}`).join("\n") || "(nenhum — é o primeiro)";
  return `Escreva o capítulo ${idx + 1} do ebook "${outline.title}" (tema: ${briefing.tema}; público: ${briefing.publico_alvo}).

CAPÍTULO ${idx + 1}: "${ch.title}"
Seções planejadas (use exatamente estes subtítulos, nesta ordem):
${ch.sections.map((s) => `- ${s}`).join("\n")}

Capítulos anteriores (não repita conteúdo):
${prevTitles}

ESTRUTURA OBRIGATÓRIA do campo "content":
1. Abra com um storytelling curto (1-2 parágrafos): uma mini-história, cena ou caso real que conecta com o tema do capítulo.
2. Depois, cada seção: comece a seção com o subtítulo prefixado por "### " (ex: "### ${ch.sections[0] ?? "Subtítulo"}"), seguido de 2-4 parágrafos de conteúdo rico.
3. Inclua pelo menos 2 exemplos práticos brasileiros, dicas concretas e, quando couber, números/dados que tornem o texto convincente para "${briefing.publico_alvo}".
4. Total: 900 a 1300 palavras — capítulo COMPLETO e aprofundado, não um resumo. Cada seção com 3-5 parágrafos ricos. Parágrafos separados por \\n\\n.

${qualityRules(briefing.idioma)}

Retorne APENAS o JSON:
{
  "content": "storytelling de abertura\\n\\n### Primeiro subtítulo\\n\\nconteúdo...\\n\\n### Segundo subtítulo\\n\\nconteúdo...",
  "acao_pratica": "Box 'Ação Prática': 3 a 5 passos acionáveis que o leitor executa hoje, um por linha separados por \\n"
}`;
}

function mockEbookContent(briefing: any): any {
  const tema = briefing.tema || "Desenvolvimento Pessoal";
  const n = Math.min(12, Math.max(7, Number(briefing.capitulos) || 7));
  const titles = ["Fundamentos Essenciais","O Que Ninguém Te Contou","O Método Passo a Passo","Colocando em Prática","Superando Obstáculos","Acelerando Resultados","Mantendo a Consistência","Ferramentas e Recursos","Cases de Sucesso","Erros que Custam Caro","Escalando os Resultados","Seu Plano de 90 Dias"];
  const chapters = Array.from({ length: n }, (_, i) => ({
    title: `${titles[i] || `Módulo ${i + 1}`}`,
    content: `Era uma terça-feira comum quando Ana percebeu que precisava mudar sua relação com ${tema}.\n\n### Por onde começar\n\nEste capítulo aborda aspectos fundamentais de ${tema}. Conteúdo completo será gerado pela IA no modo real.\n\n### O que evitar\n\nEste é apenas um conteúdo de demonstração para testar o fluxo sem gastar créditos de IA.`,
    acao_pratica: `1. Anote seu objetivo principal\n2. Separe 15 minutos por dia\n3. Aplique a primeira técnica hoje`,
    image_description: `Ilustração sobre ${tema}`,
  }));
  return {
    title: `${tema}: O Guia Definitivo`,
    subtitle: `Tudo que você precisa saber para transformar sua vida com ${tema}`,
    cover_promise: `O caminho comprovado para dominar ${tema}`,
    autor: briefing.autor || "",
    introduction: `Imagine acordar daqui a 90 dias com ${briefing.promessa || "seus objetivos"} realizados.\n\nEste ebook foi criado especialmente para ${briefing.publico_alvo || "você"}.\n\n[MODO MOCK — conteúdo real gerado pela IA no modo normal]`,
    summary: chapters.map((c) => c.title),
    chapters,
    conclusion: `Chegamos ao final desta jornada sobre ${tema}. Você agora tem todas as ferramentas necessárias para dar o próximo passo.\n\n[MODO MOCK — conteúdo real gerado pela IA no modo normal]`,
    call_to_action: `Não deixe para depois! Comece hoje mesmo a aplicar o que aprendeu. Seu sucesso começa com uma ação.`,
    bonus: ["Checklist de implementação rápida", "Planilha de acompanhamento de resultados", "Acesso à comunidade exclusiva"],
    progress: { done: n, total: n },
  };
}

async function processInBackground(opts: {
  admin: ReturnType<typeof createClient>;
  ebookId: string;
  userId: string;
  briefing: any;
}) {
  const { admin, ebookId, userId, briefing } = opts;
  const deadline = Date.now() + 330_000; // orçamento total da edge function
  try {
    // 7 a 12 capítulos (estrutura profissional)
    const chapters = Math.min(12, Math.max(7, Number(briefing.capitulos) || Math.round((Number(briefing.paginas) || 28) / 4)));

    console.log("[generate-ebook] fase 1: esqueleto", ebookId, `${chapters} capítulos`);
    const outline: Outline = await callAIWithRetry(outlinePrompt(briefing, chapters), 4000, 3, deadline, validateOutline);
    // Normaliza a quantidade planejada
    outline.chapters = outline.chapters.slice(0, chapters);

    // Salva o esqueleto imediatamente (progresso parcial)
    const baseContent: any = {
      title: outline.title,
      subtitle: outline.subtitle,
      cover_promise: outline.cover_promise ?? "",
      autor: briefing.autor || "",
      introduction: outline.introduction,
      summary: outline.chapters.map((c) => c.title),
      chapters: [] as any[],
      conclusion: outline.conclusion,
      call_to_action: outline.call_to_action,
      bonus: outline.bonus ?? [],
      briefing,
      progress: { done: 0, total: outline.chapters.length },
    };
    const { error: outlineSaveErr } = await admin.from("ebooks").update({
      title: outline.title ?? "Ebook sem título",
      content: baseContent,
    }).eq("id", ebookId);
    if (outlineSaveErr) {
      // Sem o esqueleto salvo o polling do front nunca mostra progresso — falha alto
      throw new Error(`Falha ao salvar o esqueleto no banco: ${outlineSaveErr.message}`);
    }
    console.log("[generate-ebook] esqueleto salvo no banco", ebookId);

    // Ilustrações (Gemini): rodam em PARALELO com a geração de texto e são
    // anexadas ao final. Qualquer falha de imagem apenas pula aquela imagem —
    // o ebook continua sendo gerado normalmente.
    const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    const palette = paletteFor(outline.title ?? briefing.tema ?? "ebook");
    const artBase = `${userId}/${ebookId}`;
    // Ilustrações: Gemini com cota → melhor qualidade; senão Pollinations
    // (gratuito, sem chave). FILA SEQUENCIAL com intervalo — o Pollinations
    // limita requisições concorrentes (paralelo = 429 em massa).
    const imgState: ImgState = { geminiBlocked: false };
    let imgChain: Promise<unknown> = Promise.resolve();
    const enqueueIllustration = (o: Omit<Parameters<typeof makeIllustration>[0], "admin" | "geminiKey" | "state">): Promise<string | null> => {
      const run = imgChain.then(() => makeIllustration({ admin, geminiKey, state: imgState, ...o }));
      imgChain = run.then(() => sleep(4_000));
      return run;
    };
    const chapterImageTasks: Promise<string | null>[] = [];
    const coverImageTask = enqueueIllustration({
      path: `${artBase}/cover`,
      desc: `Imagem de capa conceitual sobre: ${outline.cover_promise || outline.subtitle || briefing.tema}. Público: ${briefing.publico_alvo}`,
      tema: briefing.tema, paletteName: palette.name, label: "da capa",
    });

    // Fase 2: capítulo por capítulo, com retry e progresso salvo a cada capítulo
    const failed: number[] = [];
    for (let i = 0; i < outline.chapters.length; i++) {
      const plan = outline.chapters[i];
      // Não INICIA capítulo sem orçamento: uma chamada em andamento pode levar
      // ~100s no pior caso (cadeia de fallbacks) e o controle de deadline não
      // interrompe chamada em voo. Sem esta trava, o wall clock (~400s) mata o
      // processo antes da fase final de falha clara + refund rodar.
      if (Date.now() > deadline - 60_000) {
        console.warn(`[generate-ebook] sem orçamento de tempo para o capítulo ${i + 1} — marcando como falho`);
        failed.push(i + 1);
        baseContent.chapters.push({
          title: plan.title,
          content: "",
          acao_pratica: "",
          image_description: plan.image_description ?? "",
          generation_failed: true,
        });
        baseContent.progress = { done: i + 1, total: outline.chapters.length };
        continue;
      }
      try {
        console.log(`[generate-ebook] fase 2: capítulo ${i + 1}/${outline.chapters.length}`, ebookId);
        const ch = await callAIWithRetry(chapterPrompt(briefing, outline, i), 5000, 3, deadline, validateChapter);
        baseContent.chapters.push({
          title: plan.title,
          content: String(ch.content ?? ""),
          acao_pratica: String(ch.acao_pratica ?? ""),
          image_description: plan.image_description ?? "",
        });
      } catch (e) {
        console.error(`[generate-ebook] capítulo ${i + 1} falhou definitivamente:`, (e as Error).message);
        failed.push(i + 1);
        // NUNCA inserir texto placeholder fingindo capítulo: fica vazio e
        // marcado — se a segunda passada não recuperar, o run inteiro falha
        // com erro claro (e crédito devolvido) em vez de entregar PDF oco.
        baseContent.chapters.push({
          title: plan.title,
          content: "",
          acao_pratica: "",
          image_description: plan.image_description ?? "",
          generation_failed: true,
        });
      }
      baseContent.progress = { done: i + 1, total: outline.chapters.length };
      // Salva progresso parcial — nada se perde se a próxima chamada falhar.
      // O updated_at deste UPDATE é o heartbeat que o watchdog do front observa.
      const { error: chSaveErr } = await admin.from("ebooks").update({ content: baseContent }).eq("id", ebookId);
      if (chSaveErr) {
        console.error(`[generate-ebook] ERRO ao salvar progresso do capítulo ${i + 1}: ${chSaveErr.message}`);
      } else {
        console.log(`[generate-ebook] progresso salvo: ${i + 1}/${outline.chapters.length}`, ebookId);
      }
      // Enfileira a ilustração deste capítulo (fila roda em paralelo ao texto)
      chapterImageTasks.push(enqueueIllustration({
        path: `${artBase}/ch-${i + 1}`,
        desc: plan.image_description || plan.title,
        tema: briefing.tema, paletteName: palette.name, label: `do capítulo ${i + 1}`,
      }));
    }

    // ── Segunda passada: recupera capítulos que falharam (rate limit passa) ──
    if (failed.length && Date.now() < deadline - 45_000) {
      console.log(`[generate-ebook] segunda passada para capítulos com falha: ${failed.join(", ")} (aguardando janela de rate limit)`);
      await sleep(30_000);
      const recovered: number[] = [];
      for (const n of failed) {
        if (Date.now() > deadline - 20_000) break;
        const i = n - 1;
        try {
          const ch = await callAIWithRetry(chapterPrompt(briefing, outline, i), 5000, 2, deadline, validateChapter);
          baseContent.chapters[i].content = String(ch.content ?? "");
          baseContent.chapters[i].acao_pratica = String(ch.acao_pratica ?? "");
          delete baseContent.chapters[i].generation_failed;
          recovered.push(n);
          await admin.from("ebooks").update({ content: baseContent }).eq("id", ebookId);
          console.log(`[generate-ebook] capítulo ${n} recuperado na segunda passada`);
        } catch (e) {
          console.warn(`[generate-ebook] capítulo ${n} falhou também na segunda passada: ${(e as Error).message.slice(0, 150)}`);
        }
      }
      for (const n of recovered) failed.splice(failed.indexOf(n), 1);
    }

    // Anexa as ilustrações que ficaram prontas (falhas viram null e são puladas).
    // ESPERA LIMITADA: a fila de imagens não pode estourar o wall clock da
    // function (~400s) — senão o runtime mata o processo e o ebook fica órfão
    // em "processing". Ao esgotar o orçamento, anexa o que ficou pronto e segue.
    const imgBudgetMs = Math.max(5_000, deadline - 20_000 - Date.now());
    console.log(`[generate-ebook] aguardando ilustrações (máx ${Math.round(imgBudgetMs / 1000)}s)...`);
    const imgTimeout = sleep(imgBudgetMs).then(() => "__timeout__" as const);
    const bounded = (p: Promise<string | null>) =>
      Promise.race([p.catch(() => null), imgTimeout]).then((v) => (v === "__timeout__" ? null : v));
    const [coverUrl, ...chapterUrls] = await Promise.all([bounded(coverImageTask), ...chapterImageTasks.map(bounded)]);
    if (coverUrl) baseContent.cover_image_url = coverUrl;
    let okCount = coverUrl ? 1 : 0;
    chapterUrls.forEach((url, i) => {
      if (url && baseContent.chapters[i]) {
        baseContent.chapters[i].image_url = url;
        okCount++;
      }
    });
    console.log(`[generate-ebook] ilustrações prontas: ${okCount}/${chapterImageTasks.length + 1}`);

    // Persiste as ilustrações mesmo que a checagem abaixo falhe o run —
    // os capítulos bons (texto + imagem) ficam salvos para regeneração parcial.
    await admin.from("ebooks").update({ content: baseContent }).eq("id", ebookId);

    // ── Garantia final: NENHUM capítulo vazio/raso passa como sucesso ──────
    const badChapters = baseContent.chapters
      .map((c: any, i: number) => (wordCount(c.content) < MIN_CHAPTER_WORDS ? i + 1 : 0))
      .filter(Boolean);
    if (badChapters.length) {
      throw new Error(
        `Não foi possível gerar o conteúdo do(s) capítulo(s) ${badChapters.join(", ")} — o provedor de IA atingiu o limite de requisições. ` +
        `Seu crédito foi devolvido. Os capítulos prontos foram preservados: aguarde alguns minutos e use "Regenerar" neles no editor, ou gere o ebook novamente.`,
      );
    }

    const { error: updErr } = await admin
      .from("ebooks")
      .update({ content: baseContent, status: "completed", error_message: null })
      .eq("id", ebookId);
    if (updErr) throw new Error(updErr.message);
    console.log("[generate-ebook] concluído", ebookId);
  } catch (e) {
    const msg = (e as Error).message ?? "Falha desconhecida";
    console.error("[generate-ebook] falhou", ebookId, msg);
    // Se marcar "failed" der errado, o ebook fica órfão em "processing" —
    // loga alto e tenta de novo uma vez; o watchdog do front (reconcile) é a rede final.
    try {
      const { error: failErr } = await admin
        .from("ebooks")
        .update({ status: "failed", error_message: msg })
        .eq("id", ebookId);
      if (failErr) {
        console.error(`[generate-ebook] CRÍTICO: não conseguiu marcar failed (${failErr.message}) — tentando de novo`);
        await sleep(2000);
        const { error: retryErr } = await admin
          .from("ebooks")
          .update({ status: "failed", error_message: msg })
          .eq("id", ebookId);
        if (retryErr) console.error(`[generate-ebook] CRÍTICO: segunda tentativa de marcar failed também falhou: ${retryErr.message}`);
      }
      // devolve o crédito
      const { data: cr, error: crErr } = await admin
        .from("user_credits").select("credits").eq("user_id", userId).maybeSingle();
      if (crErr) console.error(`[generate-ebook] ERRO ao ler créditos para refund: ${crErr.message}`);
      if (cr) {
        const { error: refundErr } = await admin.from("user_credits")
          .update({ credits: (cr.credits ?? 0) + 1 }).eq("user_id", userId);
        if (refundErr) console.error(`[generate-ebook] ERRO ao devolver crédito: ${refundErr.message}`);
        else console.log("[generate-ebook] crédito devolvido", userId);
      }
    } catch (e2) {
      console.error("[generate-ebook] CRÍTICO: exceção ao marcar falha/devolver crédito:", (e2 as Error).message);
    }
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);
    if (!anthropicKey && !lovableKey && !geminiKey && !openaiKey) {
      return json({ error: "Configure ANTHROPIC_API_KEY, GEMINI_API_KEY (gratuito), LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));

    // ── Ação: reconciliar ebook órfão em "processing" ───────────────────────
    // O processamento em background tem orçamento de ~330s; se o runtime matar
    // o processo (wall clock, crash, redeploy) antes do catch rodar, o ebook
    // fica preso em "processing" para sempre. O frontend chama esta ação quando
    // detecta que o heartbeat (updated_at) parou. A checagem de tempo é feita
    // AQUI, server-side, para ninguém forjar refund de uma geração saudável.
    if (body.action === "reconcile") {
      const ebookId = String(body.ebook_id ?? "");
      if (!ebookId) return json({ error: "ebook_id é obrigatório" }, 400);
      // client do usuário: RLS garante que só o dono enxerga/reconcilia
      const { data: eb, error: eErr } = await supabase.from("ebooks")
        .select("id, status, updated_at, created_at").eq("id", ebookId).single();
      if (eErr || !eb) return json({ error: "Ebook não encontrado" }, 404);
      if (eb.status !== "processing") return json({ reconciled: false, status: eb.status });
      const lastBeat = new Date((eb as any).updated_at ?? (eb as any).created_at).getTime();
      const STALL_MS = 8 * 60_000; // > orçamento total (330s) + wall clock, com folga
      if (Date.now() - lastBeat < STALL_MS) {
        return json({ reconciled: false, status: "processing" });
      }
      console.error(`[generate-ebook] reconcile: ebook ${ebookId} órfão em processing (último heartbeat ${(eb as any).updated_at}) — marcando failed e devolvendo crédito`);
      const { data: updated, error: updErr } = await admin.from("ebooks")
        .update({
          status: "failed",
          error_message:
            "A geração foi interrompida inesperadamente no servidor. Seu crédito foi devolvido — os capítulos prontos foram preservados; tente gerar novamente ou use \"Regenerar\" nos capítulos que faltam.",
        })
        .eq("id", ebookId).eq("status", "processing")
        .select("id");
      if (updErr) return json({ error: updErr.message }, 500);
      // Refund só se ESTA chamada fez a transição (evita refund duplo em corrida)
      if (updated && updated.length > 0) {
        const { data: cr } = await admin
          .from("user_credits").select("credits").eq("user_id", userId).maybeSingle();
        if (cr) {
          await admin.from("user_credits")
            .update({ credits: (cr.credits ?? 0) + 1 }).eq("user_id", userId);
        }
        return json({ reconciled: true, status: "failed" });
      }
      return json({ reconciled: false, status: "failed" });
    }

    // ── Ação: regenerar UM capítulo (sem gastar crédito) ────────────────────
    // Usada pelo botão ↻ do editor quando um capítulo falhou ou ficou fraco.
    if (body.action === "regenerate_chapter") {
      const ebookId = String(body.ebook_id ?? "");
      const idx = Number(body.chapter_index);
      if (!ebookId || !Number.isInteger(idx) || idx < 0) {
        return json({ error: "ebook_id e chapter_index são obrigatórios" }, 400);
      }
      // client do usuário: RLS garante que só o dono acessa
      const { data: eb, error: eErr } = await supabase.from("ebooks")
        .select("id, title, content, status").eq("id", ebookId).single();
      if (eErr || !eb) return json({ error: "Ebook não encontrado" }, 404);
      const content: any = eb.content ?? {};
      const chaptersArr: any[] = Array.isArray(content.chapters) ? content.chapters : [];
      const ch = chaptersArr[idx];
      if (!ch) return json({ error: "Capítulo não encontrado" }, 404);
      const brief = content.briefing ?? {};
      const sections = [...String(ch.content ?? "").matchAll(/^###\s+(.+)$/gm)]
        .map((m) => m[1].trim()).filter(Boolean).slice(0, 5);
      const prevTitles = chaptersArr.map((c, i2) => `${i2 + 1}. ${c?.title ?? ""}`).join("\n");
      console.log(`[generate-ebook] regenerando capítulo ${idx + 1} do ebook ${ebookId}`);
      const prompt = `Escreva o capítulo ${idx + 1} do ebook "${content.title ?? eb.title}" (tema: ${brief.tema ?? content.title ?? eb.title}; público: ${brief.publico_alvo ?? "leitores interessados no tema"}).

CAPÍTULO ${idx + 1}: "${ch.title}"
${sections.length ? `Seções (use exatamente estes subtítulos, nesta ordem, prefixados por "### "):\n${sections.map((s) => `- ${s}`).join("\n")}` : `Crie 3 a 5 seções internas, cada uma com subtítulo prefixado por "### ".`}

Todos os capítulos do ebook (não repita conteúdo dos outros):
${prevTitles}

ESTRUTURA OBRIGATÓRIA do campo "content":
1. Storytelling curto de abertura (1-2 parágrafos) conectado ao tema do capítulo.
2. Seções ricas com os subtítulos "### ".
3. Pelo menos 2 exemplos práticos brasileiros e dicas concretas.
4. Total: 900 a 1300 palavras. Parágrafos separados por \\n\\n.

${qualityRules(brief.idioma)}

Retorne APENAS o JSON:
{ "content": "...", "acao_pratica": "3 a 5 passos acionáveis, um por linha" }`;
      const res = await callAIWithRetry(prompt, 5000, 3, Date.now() + 110_000, validateChapter);
      chaptersArr[idx] = {
        ...ch,
        content: String(res.content ?? ""),
        acao_pratica: String(res.acao_pratica ?? ch.acao_pratica ?? ""),
      };
      delete (chaptersArr[idx] as any).generation_failed;
      // Ilustração se estiver faltando (direto no Pollinations — não gasta cota Gemini)
      if (!chaptersArr[idx].image_url) {
        const url = await makeIllustration({
          admin, geminiKey: "", path: `${userId}/${ebookId}/ch-${idx + 1}`,
          desc: ch.image_description || ch.title,
          tema: String(brief.tema ?? content.title ?? ""),
          paletteName: paletteFor(String(content.title ?? eb.title)).name,
          label: `do capítulo ${idx + 1} (regeneração)`,
        });
        if (url) chaptersArr[idx].image_url = url;
      }
      content.chapters = chaptersArr;
      // Se o ebook estava "failed" e agora todos os capítulos têm conteúdo
      // completo, volta para "completed" (o PDF é liberado de novo no front).
      const allComplete = chaptersArr.every((c) => wordCount(c?.content) >= MIN_CHAPTER_WORDS);
      const statusPatch = (eb as any).status === "failed" && allComplete
        ? { status: "completed", error_message: null }
        : {};
      const { error: uErr } = await admin.from("ebooks")
        .update({ content, ...statusPatch }).eq("id", ebookId).eq("user_id", userId);
      if (uErr) return json({ error: uErr.message }, 500);
      return json({ ok: true, chapter: chaptersArr[idx], ...("status" in statusPatch ? { status: "completed" } : {}) });
    }

    const testMode = body.test_mode === true;
    const paginas = Math.min(Math.max(Number(body.paginas) || Number(body.capitulos) * 4 || 28, 8), 60);
    const capitulos = Number(body.capitulos) || 7;
    const briefing = {
      tema: body.tema || (testMode ? "Marketing Digital para Iniciantes" : undefined),
      publico_alvo: body.publico_alvo || (testMode ? "Empreendedores iniciantes" : undefined),
      promessa: body.promessa ?? "",
      problema: body.problema ?? "",
      autor: String(body.autor ?? ""),
      idioma: body.idioma ?? "Português",
      tom_voz: body.tom_voz ?? "Profissional e acessível",
      paginas,
      capitulos,
      uso: body.uso ?? "venda",
    };
    if (!briefing.tema || !briefing.publico_alvo) {
      return json({ error: "tema e publico_alvo são obrigatórios" }, 400);
    }

    if (testMode) {
      // Mock: sem IA, sem crédito
      const mockContent = mockEbookContent(briefing);
      const { data: ebook, error: insErr } = await admin.from("ebooks").insert({
        user_id: userId, title: mockContent.title, niche: briefing.tema,
        content: { ...mockContent, briefing }, status: "completed",
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      return json({ ebookId: ebook.id, status: "completed", test_mode: true }, 201);
    }

    // Checa créditos
    const { data: creditsRow } = await admin
      .from("user_credits").select("credits").eq("user_id", userId).maybeSingle();
    if (!creditsRow || (creditsRow.credits ?? 0) <= 0) {
      return json({ error: "Créditos insuficientes" }, 402);
    }

    // Debita 1 crédito imediatamente (refund se falhar)
    await admin.from("user_credits")
      .update({ credits: creditsRow.credits - 1 }).eq("user_id", userId);

    // Cria placeholder
    const placeholderTitle = (briefing.tema as string).slice(0, 80) || "Novo ebook";
    const { data: ebook, error: insErr } = await admin
      .from("ebooks")
      .insert({
        user_id: userId,
        title: placeholderTitle,
        niche: briefing.tema,
        content: { briefing },
        status: "processing",
      })
      .select("id")
      .single();
    if (insErr) {
      // refund
      await admin.from("user_credits")
        .update({ credits: creditsRow.credits }).eq("user_id", userId);
      return json({ error: insErr.message }, 500);
    }

    // Dispara processamento em background
    // @ts-ignore EdgeRuntime existe em Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processInBackground({ admin, ebookId: ebook.id, userId, briefing })
    );

    return json({ ebookId: ebook.id, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
