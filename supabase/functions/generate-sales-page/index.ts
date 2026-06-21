// Edge Function: generate-sales-page
// Cria/atualiza a página em "processing" e gera o HTML em background.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

function slugify(input: string) {
  return (
    input
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9\s-]/g, "")
      .trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60) || "pagina"
  );
}

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}

function stripFences(s: string) {
  let c = s.trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return c;
}

function buildHtml(sp: any, title: string) {
  const list = (arr: string[] = []) => arr.map((b) => `<li>${esc(b)}</li>`).join("");
  const beneficios = list(sp.beneficios);
  const bullets = list(sp.aprendizado);
  const paraQuem = list(sp.para_quem);
  const bonus = list(sp.bonus);
  const faq = (sp.faq ?? []).map((f: any) =>
    `<details><summary>${esc(f.pergunta)}</summary><p>${esc(f.resposta)}</p></details>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(sp.headline ?? title)}</title>
<meta name="description" content="${esc(sp.subheadline ?? "")}" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;background:#fff}
.wrap{max-width:880px;margin:0 auto;padding:24px 16px}
.hero{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:64px 16px;text-align:center}
.hero h1{font-size:clamp(28px,5vw,52px);font-weight:800;line-height:1.15;max-width:880px;margin:0 auto}
.hero p{font-size:clamp(16px,2.4vw,20px);opacity:.95;max-width:720px;margin:18px auto 0}
.cta{display:inline-block;background:#fff;color:#6366f1;font-weight:700;padding:16px 32px;border-radius:12px;text-decoration:none;margin-top:28px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
section{padding:48px 0;border-bottom:1px solid #e5e7eb}
h2{font-size:clamp(22px,3vw,32px);margin-bottom:20px;text-align:center}
.promise{background:#f8fafc;padding:32px;border-radius:16px;text-align:center;font-size:18px;font-weight:500}
ul.feat{list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
ul.feat li{background:#f1f5f9;padding:16px 20px;border-radius:12px;border-left:4px solid #6366f1}
.offer{background:linear-gradient(135deg,#f5f3ff,#ede9fe);padding:40px;border-radius:20px;text-align:center}
.bonus{background:#fef3c7;padding:24px;border-radius:14px}
.bonus h3{margin-bottom:12px;color:#92400e}
.bonus ul{padding-left:20px}
.guarantee{background:#ecfdf5;border:2px solid #10b981;padding:28px;border-radius:16px;text-align:center}
.guarantee h3{color:#065f46;margin-bottom:10px}
details{background:#f8fafc;padding:16px 20px;border-radius:10px;margin-bottom:10px;cursor:pointer}
details summary{font-weight:600;list-style:none}
.final{background:#0f172a;color:#fff;padding:64px 16px;text-align:center}
.final h2{color:#fff}
.final .cta{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
footer{padding:24px;text-align:center;color:#64748b;font-size:13px}
</style></head>
<body>
<header class="hero">
  <h1>${esc(sp.headline ?? title)}</h1>
  <p>${esc(sp.subheadline ?? "")}</p>
  <a class="cta" href="#oferta">${esc(sp.cta ?? "Quero agora")}</a>
</header>

<section class="wrap"><h2>A grande promessa</h2><div class="promise">${esc(sp.promessa_principal ?? "")}</div></section>

${beneficios ? `<section class="wrap"><h2>Benefícios</h2><ul class="feat">${beneficios}</ul></section>` : ""}
${paraQuem ? `<section class="wrap"><h2>Para quem é</h2><ul class="feat">${paraQuem}</ul></section>` : ""}
${bullets ? `<section class="wrap"><h2>O que você vai aprender</h2><ul class="feat">${bullets}</ul></section>` : ""}

<section class="wrap" id="oferta"><h2>Oferta especial</h2>
  <div class="offer">
    <p style="font-size:20px;margin-bottom:24px">${esc(sp.oferta ?? "")}</p>
    <a class="cta" href="#cta-final">${esc(sp.cta ?? "Quero agora")}</a>
  </div>
</section>

${bonus ? `<section class="wrap"><div class="bonus"><h3>🎁 Bônus exclusivos</h3><ul>${bonus}</ul></div></section>` : ""}
${sp.garantia ? `<section class="wrap"><div class="guarantee"><h3>✅ Garantia</h3><p>${esc(sp.garantia)}</p></div></section>` : ""}
${faq ? `<section class="wrap"><h2>Perguntas frequentes</h2>${faq}</section>` : ""}

<section class="final" id="cta-final">
  <h2>${esc(sp.headline ?? title)}</h2>
  <a class="cta" href="#" onclick="alert('Configure seu link de pagamento');return false">${esc(sp.cta ?? "Garantir o meu agora")}</a>
</section>
<footer>Criado com FunnelBook AI</footer>
</body></html>`;
}

async function processInBackground(opts: {
  admin: ReturnType<typeof createClient>;
  lovableKey: string;
  pageId: string;
  ebook: any;
}) {
  const { admin, lovableKey, pageId, ebook } = opts;
  try {
    const ec = ebook.content as any;
    const ctx = `Título do ebook: ${ebook.title}
Subtítulo: ${ec?.subtitle ?? ""}
Introdução: ${(ec?.introduction ?? "").slice(0, 600)}
Nicho: ${ebook.niche ?? ""}
Público-alvo: ${ec?.briefing?.publico_alvo ?? ""}
Promessa: ${ec?.briefing?.promessa ?? ""}
Problema que resolve: ${ec?.briefing?.problema ?? ""}
Capítulos: ${(ec?.summary ?? []).join(" | ")}`;

    const prompt = `Você é um copywriter de alta conversão. Crie uma página de vendas em português para este ebook:

${ctx}

Retorne APENAS JSON válido:
{
  "headline": string,
  "subheadline": string,
  "promessa_principal": string,
  "beneficios": string[],
  "para_quem": string[],
  "aprendizado": string[],
  "oferta": string,
  "bonus": string[],
  "garantia": string,
  "faq": [{ "pergunta": string, "resposta": string }],
  "cta": string
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você responde APENAS com JSON válido, sem markdown e sem cercas de código." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`IA ${aiRes.status}: ${t.slice(0, 400)}`);
    }
    const ai = await aiRes.json();
    const raw = ai.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Resposta vazia da IA");
    const sp = JSON.parse(stripFences(raw));
    const title = sp.headline ?? ebook.title;
    const html = buildHtml(sp, title);
    const { error } = await admin.from("sales_pages").update({
      title, html_content: html, status: "completed", error_message: null,
    }).eq("id", pageId);
    if (error) throw new Error(error.message);
    console.log("[generate-sales-page] concluído", pageId);
  } catch (e) {
    const msg = (e as Error).message ?? "Falha desconhecida";
    console.error("[generate-sales-page] falhou", pageId, msg);
    await admin.from("sales_pages")
      .update({ status: "failed", error_message: msg })
      .eq("id", pageId);
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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
    if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const { ebookId } = await req.json().catch(() => ({}));
    if (!ebookId) return json({ error: "ebookId obrigatório" }, 400);

    const { data: ebook, error: ebErr } = await supabase
      .from("ebooks").select("*").eq("id", ebookId).eq("user_id", userId).single();
    if (ebErr || !ebook) return json({ error: "Ebook não encontrado" }, 404);
    if (ebook.status !== "completed") return json({ error: "Aguarde o ebook terminar de ser gerado" }, 400);

    // slug único
    const base = slugify(ebook.title);
    let slug = base;
    let suffix = 0;
    while (true) {
      const { data: ex } = await admin
        .from("sales_pages").select("id, ebook_id").eq("slug", slug).maybeSingle();
      if (!ex || ex.ebook_id === ebookId) break;
      suffix++;
      slug = `${base}-${suffix}`;
    }

    const { data: existing } = await supabase
      .from("sales_pages").select("id").eq("ebook_id", ebookId).maybeSingle();

    let pageId: string;
    if (existing) {
      await admin.from("sales_pages")
        .update({ status: "processing", error_message: null, slug, is_published: true })
        .eq("id", existing.id);
      pageId = existing.id;
    } else {
      const { data: created, error: insErr } = await admin
        .from("sales_pages")
        .insert({
          user_id: userId, ebook_id: ebookId, title: ebook.title, slug,
          html_content: "", is_published: true, status: "processing",
        })
        .select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      pageId = created.id;
    }

    // @ts-ignore
    EdgeRuntime.waitUntil(processInBackground({ admin, lovableKey, pageId, ebook }));

    return json({ pageId, slug, status: "processing" }, 202);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
