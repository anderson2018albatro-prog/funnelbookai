// Edge Function: sales-chat-builder
// Construtor de página de vendas via CHAT: o usuário conversa com a IA,
// descreve o que quer (textos, seções, oferta, depoimentos) e envia imagens
// (via Supabase Storage, o cliente manda a URL). A cada turno a IA responde
// e devolve um PATCH nos blocos da página, que é aplicado, re-renderizado
// e salvo — o preview do cliente atualiza em tempo real.
//
// Ações:
//   { action: "load", page_id }        → histórico + blocos atuais
//   { page_id?, message: { text, image_url? }, test_mode? }
//     → cria a página no primeiro turno; retorna { page_id, slug, reply, blocks }
//
// Guardrails éticos (reforçados no prompt e no servidor):
//   - Sem cloaking, popups enganosos ou contadores/contagens falsas
//   - Depoimentos SÓ com material fornecido pelo usuário; exemplos são
//     sempre marcados is_placeholder (o renderer exibe aviso)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/ai.ts";
import { jsonrepair } from "https://esm.sh/jsonrepair@3.6.1";
import {
  buildBlocksFromAI, renderBlocksToHtml, backfillBlocks, DEFAULT_ORDER, orderForStructure,
  type SalesBlocks, type BlockKey, type PageStructure,
} from "../_shared/sales-blocks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type ChatMsg = { role: "user" | "assistant"; content: string; image_url?: string };

function slugify(input: string) {
  return (input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "pagina");
}
function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f >= 0 && l > f) c = c.slice(f, l + 1);
  return c;
}
function repairControlChars(s: string): string {
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
function parseLoose(raw: string): any {
  const cleaned = repairControlChars(stripFences(raw));
  try { return JSON.parse(cleaned); } catch { /* continua */ }
  return JSON.parse(jsonrepair(cleaned));
}
function isValidUrl(u: string) {
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; }
}

// ── Prompt do construtor ─────────────────────────────────────────────────────
const BUILDER_SYSTEM = `Você é um construtor de páginas de vendas profissional: copywriter brasileiro de resposta direta (Hotmart/Kiwify/Eduzz) conversando com o usuário para montar a página dele bloco a bloco.

COMO FUNCIONA:
- O usuário descreve o que quer na página (textos, seções, oferta, depoimentos) e pode ANEXAR IMAGENS — elas aparecem na conversa como "[IMAGEM ANEXADA: url]".
- Você responde de forma curta e amigável em "reply" E aplica as mudanças na página via "patch".
- Faça UMA ou DUAS perguntas de esclarecimento por vez quando faltar informação essencial (preço, garantia, link de checkout, público). Não interrogue: se der para avançar com o que já tem, avance e pergunte só o que falta.
- Escreva copy de resposta direta de alta qualidade: headline com big idea + benefício + curiosidade, lead que agita a dor, bullets de fascínio, oferta com ancoragem, FAQ que quebra objeções.

FORMATO DA RESPOSTA — retorne APENAS este JSON (sem markdown, sem texto fora do JSON; use \\n para quebras de linha dentro de strings):
{
  "reply": "sua resposta curta ao usuário (pode conter perguntas)",
  "patch": { ...mudanças nos blocos... } | null
}

BLOCOS DISPONÍVEIS NO PATCH (envie SÓ os que mudar; inclua "visible": true ao preencher um bloco):
- "hero": {"visible", "headline", "subheadline", "cta_text"}
- "video_vsl": {"visible", "title", "video_url"}
- "dor": {"visible", "title", "text"}  ← seção de dor/problema (parágrafos com \\n\\n)
- "mecanismo": {"visible", "title", "nome", "text"}  ← mecanismo único nomeado
- "product": {"visible", "image_url", "video_url"}  ← foto/vídeo do produto
- "promessa": {"visible", "title", "text"}
- "beneficios": {"visible", "title", "items": string[]}
- "para_quem": {"visible", "title", "items": string[]}
- "aprendizado": {"visible", "title", "items": string[]}
- "stack": {"visible", "title", "items": [{"item","valor"}], "total_value", "price", "anchor_text", "cta_text", "cta_url"}
- "bonus": {"visible", "title", "items": string[]}
- "depoimentos": {"visible", "title", "items": [{"name","text","stars","image_url"}], "is_placeholder"}
- "oferta": {"visible", "title", "description", "price", "cta_text", "cta_url"}
- "garantia": {"visible", "title", "text", "image_url"}  ← image_url = selo enviado pelo usuário
- "urgencia": {"visible", "title", "text"}
- "faq": {"visible", "title", "items": [{"pergunta","resposta"}]}
- "final_cta": {"visible", "headline", "cta_text", "cta_url"}
Também aceitos no patch: "structure" ("vsl"|"carta"|"lancamento"|"low_ticket"|"high_ticket"|"assinatura" — reordena os blocos), "theme" ("clean"|"dark"|"highconvert").

REGRAS DE PATCH:
- Ao alterar uma LISTA (items), retorne a lista COMPLETA como deve ficar (o servidor substitui, não mescla listas).
- Quando o usuário der o link de checkout, aplique em stack.cta_url, oferta.cta_url e final_cta.cta_url.
- IMAGEM ANEXADA: decida pela conversa onde ela entra — foto do produto → product.image_url; print/foto de depoimento → item em depoimentos com image_url; selo de garantia → garantia.image_url. Se não der para saber, pergunte onde colocar. NUNCA ignore uma imagem anexada.
- Para esconder um bloco: {"visible": false}.

GUARDRAILS ÉTICOS (obrigatórios, não negociáveis):
- NUNCA sugira ou gere cloaking, popups enganosos, botões que fingem ser outra coisa, contadores regressivos falsos ou "vagas restantes" inventadas. Urgência só se for REAL e informada pelo usuário (turma com data, bônus de lançamento).
- DEPOIMENTOS: só insira depoimentos com nome/texto/imagem que o usuário FORNECEU. Se o usuário pedir para "inventar depoimentos", explique que depoimentos falsos são ilegais (CDC) e ofereça criar exemplos claramente marcados — nesse caso use "is_placeholder": true (a página exibe um aviso para substituí-los).
- Não faça promessas de resultado garantido, cura ou ganho financeiro certo.`;

function buildStateContext(blocks: SalesBlocks): string {
  // Estado compacto: só o que está visível/preenchido interessa para a IA
  const slim: any = { structure: blocks.structure ?? null, theme: blocks.theme ?? "clean", data: {} };
  for (const key of DEFAULT_ORDER) {
    const b: any = (blocks.data as any)[key];
    if (!b) continue;
    slim.data[key] = b;
  }
  return JSON.stringify(slim).slice(0, 7000);
}

// Aplica o patch da IA nos blocos com validação de chaves
function applyPatch(blocks: SalesBlocks, patch: any): SalesBlocks {
  if (!patch || typeof patch !== "object") return blocks;
  const next: SalesBlocks = { ...blocks, data: { ...(blocks.data as any) } as any };
  if (typeof patch.theme === "string" && ["clean", "dark", "highconvert"].includes(patch.theme)) {
    next.theme = patch.theme;
  }
  if (typeof patch.structure === "string" &&
    ["vsl", "carta", "lancamento", "low_ticket", "high_ticket", "assinatura"].includes(patch.structure)) {
    next.structure = patch.structure as PageStructure;
    next.order = orderForStructure(next.structure);
  }
  for (const key of DEFAULT_ORDER) {
    const p = patch[key];
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const current: any = (next.data as any)[key] ?? {};
    const merged: any = { ...current };
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined) continue;
      merged[k] = v;
    }
    // URLs de CTA/imagem: só http(s) (evita javascript: etc.)
    for (const uk of ["cta_url", "image_url", "video_url"]) {
      if (typeof merged[uk] === "string" && merged[uk] && merged[uk] !== "#" && !isValidUrl(merged[uk])) merged[uk] = "";
    }
    if (Array.isArray(merged.items)) {
      merged.items = merged.items.filter((it: any) => it != null).map((it: any) => {
        if (it && typeof it === "object" && typeof it.image_url === "string" && it.image_url && !isValidUrl(it.image_url)) {
          return { ...it, image_url: "" };
        }
        return it;
      });
    }
    (next.data as any)[key] = merged;
  }
  return next;
}

function historyToAiMessages(history: ChatMsg[]): { role: "user" | "assistant"; content: string }[] {
  return history.slice(-20).map((m) => ({
    role: m.role,
    content: m.image_url ? `${m.content}\n[IMAGEM ANEXADA: ${m.image_url}]` : m.content,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const testMode = body.test_mode === true;

    // ── Carregar conversa existente ─────────────────────────────────────────
    if (body.action === "load") {
      const pageId = String(body.page_id ?? "");
      if (!pageId) return json({ error: "page_id obrigatório" }, 400);
      const { data: page, error: pErr } = await supabase.from("sales_pages")
        .select("id, slug, title, blocks, status").eq("id", pageId).single();
      if (pErr || !page) return json({ error: "Página não encontrada" }, 404);
      const { data: chat } = await supabase.from("sales_chats")
        .select("messages").eq("page_id", pageId).maybeSingle();
      return json({
        page_id: page.id, slug: page.slug, title: page.title,
        blocks: backfillBlocks((page.blocks ?? { order: [], data: {} }) as SalesBlocks),
        messages: (chat?.messages ?? []) as ChatMsg[],
      });
    }

    // ── Turno de conversa ───────────────────────────────────────────────────
    const text = String(body.message?.text ?? "").slice(0, 4000).trim();
    const imageUrl = String(body.message?.image_url ?? "").trim();
    if (!text && !imageUrl) return json({ error: "Mensagem vazia" }, 400);
    if (imageUrl && !isValidUrl(imageUrl)) return json({ error: "URL de imagem inválida" }, 400);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!testMode && !anthropicKey && !lovableKey && !geminiKey && !openaiKey) {
      return json({ error: "Configure ANTHROPIC_API_KEY, GEMINI_API_KEY (gratuito), LOVABLE_API_KEY ou OPENAI_API_KEY" }, 500);
    }

    // Página: carrega existente (do dono, via RLS) ou cria uma nova
    let pageId = String(body.page_id ?? "");
    let slug = "";
    let blocks: SalesBlocks;
    let history: ChatMsg[] = [];

    if (pageId) {
      const { data: page, error: pErr } = await supabase.from("sales_pages")
        .select("id, slug, blocks").eq("id", pageId).single();
      if (pErr || !page) return json({ error: "Página não encontrada" }, 404);
      slug = page.slug;
      blocks = backfillBlocks((page.blocks ?? { order: [], data: {} }) as SalesBlocks);
      const { data: chat } = await supabase.from("sales_chats")
        .select("messages").eq("page_id", pageId).maybeSingle();
      history = ((chat?.messages ?? []) as ChatMsg[]).slice(-60);
    } else {
      // slug único a partir da primeira mensagem
      const base = slugify(text.slice(0, 40) || "pagina-chat");
      slug = base;
      let n = 0;
      while (true) {
        const { data: ex } = await admin.from("sales_pages").select("id").eq("slug", slug).maybeSingle();
        if (!ex) break;
        n++; slug = `${base}-${n}`;
      }
      blocks = buildBlocksFromAI({}, "Página em construção");
      blocks.data.hero.headline = "";
      const { data: created, error: insErr } = await admin.from("sales_pages").insert({
        user_id: userId, title: "Página em construção (chat)", slug,
        html_content: "", blocks, is_published: true, status: "completed",
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      pageId = created.id;
      await admin.from("sales_chats").insert({ user_id: userId, page_id: pageId, messages: [] });
    }

    const userMsg: ChatMsg = { role: "user", content: text || "(imagem enviada)", ...(imageUrl ? { image_url: imageUrl } : {}) };
    history = [...history, userMsg];

    // ── IA (ou mock no test_mode) ───────────────────────────────────────────
    let reply = "";
    let patch: any = null;
    if (testMode) {
      reply = "🧪 [MODO TESTE] Apliquei sua mensagem na headline. Qual é o preço do produto e o link de checkout?";
      patch = { hero: { visible: true, headline: text.slice(0, 90) || "Headline de teste", subheadline: "Subheadline gerada no modo teste, sem IA.", cta_text: "Quero agora" } };
      if (imageUrl) patch.product = { visible: true, image_url: imageUrl };
    } else {
      const system = `${BUILDER_SYSTEM}\n\nESTADO ATUAL DA PÁGINA (JSON dos blocos — aplique patches sobre isto):\n${buildStateContext(blocks)}`;
      const raw = await chatCompletion([
        { role: "system", content: system },
        ...historyToAiMessages(history),
      ], 3500);
      if (!raw) throw new Error("Resposta vazia da IA");
      const parsed = parseLoose(raw);
      reply = String(parsed.reply ?? "Certo! Atualizei a página.");
      patch = parsed.patch ?? null;
    }

    // Guardrail servidor: depoimentos criados sem material do usuário na
    // conversa recente são sempre marcados como exemplo
    if (patch?.depoimentos?.items?.length) {
      const convText = history.filter((m) => m.role === "user").map((m) => m.content).join("\n").toLowerCase();
      const hasUserMaterial = patch.depoimentos.items.every((it: any) =>
        (it?.image_url && String(it.image_url).length > 0) ||
        (it?.text && convText.includes(String(it.text).slice(0, 40).toLowerCase())));
      if (!hasUserMaterial && patch.depoimentos.is_placeholder !== true) {
        patch.depoimentos.is_placeholder = true;
      }
    }

    blocks = applyPatch(blocks, patch);
    const title = blocks.data.hero?.headline || "Página em construção (chat)";
    const html = renderBlocksToHtml(blocks, title);

    const assistantMsg: ChatMsg = { role: "assistant", content: reply };
    const newHistory = [...history, assistantMsg].slice(-80);

    const { error: upErr } = await admin.from("sales_pages")
      .update({ blocks, html_content: html, title }).eq("id", pageId).eq("user_id", userId);
    if (upErr) return json({ error: upErr.message }, 500);
    await admin.from("sales_chats")
      .update({ messages: newHistory, updated_at: new Date().toISOString() })
      .eq("page_id", pageId).eq("user_id", userId);

    return json({ page_id: pageId, slug, reply, blocks, messages: newHistory });
  } catch (e) {
    console.error("[sales-chat-builder]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
