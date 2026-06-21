// Edge Function: generate-presell
// Generates an ethical presell/bridge page using AI.
// NEVER drops affiliate cookies. CTA links open in a new tab with rel="sponsored nofollow noopener".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function slugify(s: string) {
  return (s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "presell");
}
function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const f = c.indexOf("{"), l = c.lastIndexOf("}");
  if (f >= 0 && l > f) c = c.slice(f, l + 1);
  return c;
}

const VALID_TYPES = ["review", "advertorial", "quiz", "comparativo", "bridge", "vsl", "cookie_notice"];

function defaultOrderFor(type: string): string[] {
  switch (type) {
    case "advertorial": return ["headline","media","story","what_is","how_it_works","benefits","proof","cta"];
    case "quiz": return ["headline","quiz","cta"];
    case "comparativo": return ["headline","comparison","benefits","cta"];
    case "bridge": return ["headline","benefits","cookie_notice","cta"];
    case "vsl": return ["headline","video","benefits","cta"];
    case "cookie_notice": return ["headline","cookie_notice","cta"];
    default: return ["headline","media","intro","what_is","for_whom","benefits","pros","cons","cta"];
  }
}

function buildBlocks(p: any, type: string, affUrl: string) {
  return {
    type, affiliate_url: affUrl || "#", order: defaultOrderFor(type),
    data: {
      headline: { visible: true, title: p.headline ?? "", subtitle: p.subheadline ?? "" },
      media: { visible: false, image_url: "" },
      intro: { visible: !!p.intro, text: p.intro ?? "" },
      what_is: { visible: !!p.what_is, title: "O que é", text: p.what_is ?? "" },
      for_whom: { visible: (p.for_whom ?? []).length > 0, title: "Para quem é", items: p.for_whom ?? [] },
      benefits: { visible: (p.benefits ?? []).length > 0, title: "Benefícios", items: p.benefits ?? [] },
      pros: { visible: (p.pros ?? []).length > 0, title: "Pontos positivos", items: p.pros ?? [] },
      cons: { visible: (p.cons ?? []).length > 0, title: "Pontos de atenção", items: p.cons ?? [] },
      story: { visible: !!p.story, title: "História", text: p.story ?? "" },
      how_it_works: { visible: !!p.how_it_works, title: "Como funciona", text: p.how_it_works ?? "" },
      proof: { visible: (p.proof ?? []).length > 0, title: "Provas", items: p.proof ?? [] },
      comparison: {
        visible: !!p.comparison, title: "Comparativo",
        product_a: p.comparison?.product_a ?? "", product_b: p.comparison?.product_b ?? "",
        rows: p.comparison?.rows ?? [], winner: p.comparison?.winner ?? "",
      },
      quiz: {
        visible: (p.quiz?.questions ?? []).length > 0,
        title: p.quiz?.title ?? "Descubra a melhor opção",
        questions: p.quiz?.questions ?? [], result: p.quiz?.result ?? "",
      },
      video: { visible: type === "vsl", title: "Assista", video_url: "" },
      cookie_notice: {
        visible: true,
        text: p.cookie_notice ?? "Aviso: ao clicar no botão você será redirecionado para o site oficial. Nenhum cookie de afiliado é definido até você clicar.",
      },
      cta: {
        visible: true,
        text: p.cta_text ?? "Acessar site oficial",
        note: "Você será redirecionado para o site oficial do produto.",
      },
    },
  };
}

function renderHtml(blocks: any, fallbackTitle: string): string {
  const d = blocks.data, aff = blocks.affiliate_url || "#";
  const order: string[] = blocks.order;
  const cta = (label: string) =>
    `<a class="cta" href="${esc(aff)}" target="_blank" rel="sponsored nofollow noopener">${esc(label)}</a>`;
  const ul = (items: string[]) => (items || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("");
  const sec: string[] = [];
  for (const key of order) {
    const b: any = d[key]; if (!b || !b.visible) continue;
    switch (key) {
      case "headline":
        sec.push(`<header class="hero"><h1>${esc(b.title)}</h1>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ""}</header>`); break;
      case "intro": if (b.text) sec.push(`<section class="wrap"><p class="lead">${esc(b.text)}</p></section>`); break;
      case "what_is": case "story": case "how_it_works":
        if (b.text) sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></section>`); break;
      case "for_whom": case "benefits": case "pros": case "cons": case "proof":
        if (b.items?.length) sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><ul class="feat">${ul(b.items)}</ul></section>`); break;
      case "comparison": {
        const rows = (b.rows || []).map((r: any) => `<tr><td>${esc(r.feature)}</td><td>${esc(r.a)}</td><td>${esc(r.b)}</td></tr>`).join("");
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2><table class="cmp"><thead><tr><th></th><th>${esc(b.product_a)}</th><th>${esc(b.product_b)}</th></tr></thead><tbody>${rows}</tbody></table>${b.winner ? `<p><strong>Melhor opção:</strong> ${esc(b.winner)}</p>` : ""}</section>`); break;
      }
      case "quiz": {
        const qs = (b.questions || []).map((q: any, i: number) => `<div class="q"><h3>${i + 1}. ${esc(q.question)}</h3><ul>${(q.options || []).map((o: string) => `<li>${esc(o)}</li>`).join("")}</ul></div>`).join("");
        sec.push(`<section class="wrap"><h2>${esc(b.title)}</h2>${qs}${b.result ? `<div class="result"><strong>Recomendação:</strong> ${esc(b.result)}</div>` : ""}</section>`); break;
      }
      case "cookie_notice": if (b.text) sec.push(`<section class="wrap"><div class="notice">${esc(b.text)}</div></section>`); break;
      case "cta":
        sec.push(`<section class="wrap final">${cta(b.text || "Acessar site oficial")}${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}</section>`); break;
    }
  }
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(d.headline?.title || fallbackTitle)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;line-height:1.6;color:#0f172a;background:#fff}
.wrap{max-width:780px;margin:0 auto;padding:32px 16px}
.hero{background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;padding:56px 16px;text-align:center}
.hero h1{font-size:clamp(26px,4.5vw,44px);font-weight:800}.hero p{margin-top:14px;font-size:18px;opacity:.95}
h2{font-size:clamp(20px,2.6vw,28px);margin-bottom:14px}.lead{font-size:18px;color:#334155}
ul.feat{list-style:none;display:grid;gap:10px}ul.feat li{background:#f1f5f9;padding:12px 16px;border-radius:10px;border-left:4px solid #6366f1}
.cmp{width:100%;border-collapse:collapse}.cmp th,.cmp td{padding:10px;border:1px solid #e2e8f0;text-align:left}.cmp th{background:#f8fafc}
.q{background:#f8fafc;padding:14px;border-radius:10px;margin-bottom:10px}.q ul{margin-top:6px;padding-left:18px}
.result{background:#ecfdf5;border:1px solid #10b981;padding:14px;border-radius:10px;margin-top:10px}
.notice{background:#fef3c7;border:1px solid #f59e0b;color:#78350f;padding:14px 16px;border-radius:10px;font-size:14px}
.final{text-align:center}.cta{display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:700;padding:16px 36px;border-radius:12px;text-decoration:none}
.note{margin-top:14px;color:#64748b;font-size:13px}
footer{padding:24px;text-align:center;color:#64748b;font-size:12px}</style></head><body>
${sec.join("\n")}
<footer>Página de recomendação. Ao clicar no botão você é redirecionado para o site oficial. Podemos receber comissão por compras realizadas.</footer></body></html>`;
}

async function fetchSourceInfo(url: string): Promise<{ title: string; description: string; text: string } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (FunnelBookAI Presell Bot)" } });
    if (!res.ok) return null;
    const html = await res.text();
    const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "").trim();
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "").trim();
    const ogd = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "").trim();
    const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
    return { title, description: desc || ogd, text: stripped };
  } catch { return null; }
}

async function processBg(opts: {
  admin: ReturnType<typeof createClient>; lovableKey: string; presellId: string;
  source_url: string; affiliate_url: string; presell_type: string;
  niche: string; target_audience: string; tone: string; language: string; extra_prompt: string;
}) {
  const { admin, lovableKey, presellId, source_url, affiliate_url, presell_type, niche, target_audience, tone, language, extra_prompt } = opts;
  try {
    const info = await fetchSourceInfo(source_url);
    const ctx = `Tipo de presell: ${presell_type}
Nicho: ${niche}
Público-alvo: ${target_audience}
Tom de voz: ${tone}
Idioma: ${language || "pt-BR"}
Link de afiliado (NÃO incluir no conteúdo, será aplicado no CTA): ${affiliate_url}
Link da página/produto: ${source_url || "(não informado)"}
Informações extraídas do link: ${info ? `Título: ${info.title}\nDescrição: ${info.description}\nTrecho: ${info.text.slice(0, 1500)}` : "(não foi possível ler)"}
Comando extra: ${extra_prompt}`;
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é copywriter especialista em presells éticas para afiliados. Responda APENAS com JSON válido, sem markdown. NUNCA promova cookie stuffing. O CTA sempre depende do clique do usuário." },
          { role: "user", content: `Crie uma presell (tipo ${presell_type}) com base em:
${ctx}

Retorne JSON com os campos relevantes para o tipo:
{
 "headline": string,
 "subheadline": string,
 "intro": string,
 "what_is": string,
 "for_whom": string[],
 "benefits": string[],
 "pros": string[],
 "cons": string[],
 "story": string,
 "how_it_works": string,
 "proof": string[],
 "comparison": {"product_a":string,"product_b":string,"rows":[{"feature":string,"a":string,"b":string}],"winner":string} | null,
 "quiz": {"title":string,"questions":[{"question":string,"options":string[]}],"result":string} | null,
 "cookie_notice": string,
 "cta_text": string
}` },
        ],
      }),
    });
    if (!aiRes.ok) throw new Error(`IA ${aiRes.status}: ${(await aiRes.text()).slice(0, 400)}`);
    const ai = await aiRes.json();
    const raw = ai.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Resposta vazia da IA");
    const p = JSON.parse(stripFences(raw));
    const blocks = buildBlocks(p, presell_type, affiliate_url);
    const title = p.headline || info?.title || "Presell";
    const html = renderHtml(blocks, title);
    const { error } = await admin.from("presells")
      .update({ title, blocks, html_content: html, status: "completed", error_message: null }).eq("id", presellId);
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
    if (!lovableKey || !serviceKey) return json({ error: "Chaves não configuradas" }, 500);
    const supabase = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    let { source_url = "", affiliate_url = "", presell_type = "review",
      niche = "", target_audience = "", tone = "", language = "pt-BR", extra_prompt = "" } = body;
    if (!affiliate_url) return json({ error: "Informe o link de afiliado" }, 400);
    if (!VALID_TYPES.includes(presell_type)) presell_type = "review";

    const base = slugify((source_url ? new URL(source_url).hostname.replace(/^www\./, "") : "") + "-" + presell_type);
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
    }).select("id").single();
    if (insErr) return json({ error: insErr.message }, 500);

    // @ts-ignore
    EdgeRuntime.waitUntil(processBg({
      admin, lovableKey, presellId: created.id,
      source_url, affiliate_url, presell_type, niche, target_audience, tone, language, extra_prompt,
    }));

    return json({ presellId: created.id, slug, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
