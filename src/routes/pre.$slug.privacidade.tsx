import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const fetchPresellMeta = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
    );
    const { data: row } = await client
      .from("presells")
      .select("title, slug, disclosure_text, is_published")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!row) return null;
    return { title: row.title, slug: row.slug, disclosure: row.disclosure_text };
  });

const opts = (slug: string) =>
  queryOptions({ queryKey: ["presell-privacy", slug], queryFn: () => fetchPresellMeta({ data: { slug } }) });

export const Route = createFileRoute("/pre/$slug/privacidade")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `Política de Privacidade — ${loaderData.title}` }]
      : [{ title: "Política de Privacidade" }],
  }),
  component: PrivacyPage,
  notFoundComponent: () => <div className="p-10 text-center">Página não encontrada</div>,
});

function PrivacyPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  if (!data) throw notFound();

  const year = new Date().getFullYear();
  const presellUrl = typeof window !== "undefined" ? `${window.location.origin}/pre/${slug}` : `/pre/${slug}`;

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", lineHeight: 1.7, color: "#1e293b", background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>
        <a href={presellUrl} style={{ color: "#6366f1", fontSize: 14, textDecoration: "none", display: "block", marginBottom: 32 }}>
          ← Voltar para {data.title}
        </a>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Política de Privacidade</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 40 }}>Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <Section title="1. Quem somos">
          <p>Esta página — <strong>{data.title}</strong> — é um conteúdo independente criado para informar o visitante sobre o produto anunciado. Não somos o fabricante nem o vendedor oficial do produto.</p>
        </Section>

        <Section title="2. Links de afiliado">
          <p>{data.disclosure || "Esta página pode conter links de afiliado. Quando você clica e realiza uma compra, podemos receber uma comissão sem custo adicional para você."}</p>
          <p style={{ marginTop: 12 }}>Todos os redirecionamentos ocorrem <strong>somente após um clique real do usuário</strong>. Não utilizamos cookies de rastreamento, pixel de conversão oculto, clique automático, iframe oculto ou qualquer técnica de cookie stuffing.</p>
        </Section>

        <Section title="3. Dados coletados">
          <p>Esta página <strong>não coleta dados pessoais</strong> diretamente. Nenhum formulário, cadastro ou login é solicitado.</p>
          <p style={{ marginTop: 12 }}>Caso você seja redirecionado para o site oficial do produto, a política de privacidade daquele site será aplicada a partir do momento do redirecionamento.</p>
        </Section>

        <Section title="4. Cookies">
          <p>Esta página pode utilizar cookies técnicos essenciais para o funcionamento básico (como preferências de sessão). Nenhum cookie de rastreamento de terceiros é definido antes de um clique explícito do usuário.</p>
        </Section>

        <Section title="5. Conteúdo">
          <p>O conteúdo desta página tem finalidade informativa. Opiniões, análises e resultados mencionados são exemplos ilustrativos ou experiências de terceiros. Resultados individuais podem variar.</p>
          <p style={{ marginTop: 12 }}>Depoimentos apresentados como "exemplo" ou "placeholder" são fictícios e devem ser substituídos por depoimentos reais antes da publicação comercial.</p>
        </Section>

        <Section title="6. Contato">
          <p>Para dúvidas sobre este conteúdo, utilize o canal de suporte do produto oficial para o qual você foi redirecionado.</p>
        </Section>

        <p style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>
          © {year} · Conteúdo independente. Criado com FunnelBook AI.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>{title}</h2>
      <div style={{ color: "#334155", fontSize: 15 }}>{children}</div>
    </div>
  );
}
