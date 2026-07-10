import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { renderPresellHtml, type PresellBlocks } from "@/lib/presell-blocks";

const fetchPresell = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
    );
    const { data: row } = await client
      .from("presells")
      .select("title, slug, html_content, blocks, is_published, product_image_url, source_url")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!row) return null;
    // official_url dos blocks tem prioridade; source_url (página analisada pela
    // IA) serve de fallback — presells antigas ganham o link oficial sem re-salvar.
    const blocks = row.blocks
      ? { ...(row.blocks as PresellBlocks), official_url: (row.blocks as any).official_url || row.source_url || "" }
      : null;
    const html = blocks
      ? renderPresellHtml(blocks, row.title, row.slug)
      : (row.html_content ?? "");
    return { title: row.title, slug: row.slug, html, og_image: row.product_image_url ?? null };
  });

const opts = (slug: string) =>
  queryOptions({ queryKey: ["public-presell", slug], queryFn: () => fetchPresell({ data: { slug } }) });

export const Route = createFileRoute("/pre/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.title },
          { name: "description", content: loaderData.title },
          { property: "og:title", content: loaderData.title },
          ...(loaderData.og_image ? [{ property: "og:image", content: loaderData.og_image }] : []),
        ]
      : [{ title: "Presell não encontrada" }],
  }),
  component: PublicPresell,
  notFoundComponent: () => <div className="p-10 text-center">Presell não encontrada</div>,
  errorComponent: () => <div className="p-10 text-center">Erro ao carregar</div>,
});

function PublicPresell() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  if (!data) throw notFound();

  // Ethical click tracking: only AFTER a real user click on a CTA, increment counter.
  // Never blocks navigation, never rewrites the link, never masks the affiliate URL.
  useEffect(() => {
    let fired = false;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("a[data-cta='1']");
      if (!target) return;
      if (fired) return; fired = true;
      try { supabase.rpc("increment_presell_clicks", { _slug: slug }); } catch { /* noop */ }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [slug]);

  return <div dangerouslySetInnerHTML={{ __html: data.html }} />;
}
