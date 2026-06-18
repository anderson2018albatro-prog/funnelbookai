import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Check, Shield, Sparkles } from "lucide-react";

const fetchPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
    );
    const { data: page } = await supabase
      .from("sales_pages")
      .select("headline, subheadline, beneficios, aprendizados, faq, garantia, cta_text, cta_url, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!page) return null;
    return page;
  });

const pageOpts = (slug: string) =>
  queryOptions({ queryKey: ["public-page", slug], queryFn: () => fetchPage({ data: { slug } }) });

export const Route = createFileRoute("/p/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(pageOpts(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.headline },
          { name: "description", content: loaderData.subheadline ?? "" },
          { property: "og:title", content: loaderData.headline },
          { property: "og:description", content: loaderData.subheadline ?? "" },
        ]
      : [{ title: "Página não encontrada" }],
  }),
  component: PublicSalesPage,
  notFoundComponent: () => <div className="p-10 text-center">Página não encontrada</div>,
});

function PublicSalesPage() {
  const { slug } = Route.useParams();
  const { data: page } = useSuspenseQuery(pageOpts(slug));
  if (!page) throw notFound();

  const beneficios = (page.beneficios as string[]) ?? [];
  const aprendizados = (page.aprendizados as string[]) ?? [];
  const faq = (page.faq as { pergunta: string; resposta: string }[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Lançamento
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-4xl md:text-6xl">{page.headline}</h1>
          {page.subheadline && <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">{page.subheadline}</p>}
          <a href={page.cta_url ?? "#cta"} className="inline-block w-full sm:w-auto">
            <Button size="lg" className="mt-8 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 sm:mt-10 sm:w-auto">
              {page.cta_text}
            </Button>
          </a>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">Benefícios</h2>
        <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 md:grid-cols-2">
          {beneficios.map((b, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-border bg-gradient-card p-4 text-sm sm:p-5 sm:text-base">
              <Check className="mt-1 h-5 w-5 shrink-0 text-success" />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Learn */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">O que você aprenderá</h2>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:mt-10">
          {aprendizados.map((a, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm sm:text-base">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-primary text-xs font-semibold text-primary-foreground">{i + 1}</div>
              <span className="min-w-0">{a}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">Perguntas frequentes</h2>
        <div className="mt-8 space-y-3 sm:mt-10">
          {faq.map((f, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card p-4 sm:p-5">
              <summary className="cursor-pointer list-none font-medium">{f.pergunta}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.resposta}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Garantia */}
      {page.garantia && (
        <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="rounded-2xl border border-border bg-gradient-card p-5 text-center shadow-elegant sm:p-6">
            <Shield className="mx-auto h-8 w-8 text-success" />
            <h3 className="mt-3 font-display text-xl font-bold">Garantia</h3>
            <p className="mt-2 text-sm text-muted-foreground">{page.garantia}</p>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section id="cta" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="rounded-3xl border border-border bg-gradient-card p-6 text-center shadow-elegant sm:p-10">
          <h2 className="font-display text-2xl font-bold sm:text-3xl md:text-4xl">{page.headline}</h2>
          <a href={page.cta_url ?? "#"} className="inline-block w-full sm:w-auto">
            <Button size="lg" className="mt-8 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto">
              {page.cta_text}
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Criado com <a href="/" className="text-primary hover:underline">FunnelBook AI</a>
      </footer>
    </div>
  );
}
