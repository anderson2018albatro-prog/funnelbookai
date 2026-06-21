import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { renderPresellHtml, type PresellBlocks } from "@/lib/presell-blocks";

const fetchPresell = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
    );
    const { data: row } = await supabase
      .from("presells")
      .select("title, slug, html_content, blocks, is_published")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!row) return null;
    const html = row.blocks
      ? renderPresellHtml(row.blocks as PresellBlocks, row.title)
      : (row.html_content ?? "");
    return { title: row.title, slug: row.slug, html };
  });

const opts = (slug: string) =>
  queryOptions({ queryKey: ["public-presell", slug], queryFn: () => fetchPresell({ data: { slug } }) });

export const Route = createFileRoute("/pre/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: loaderData.title }, { property: "og:title", content: loaderData.title }]
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
  return <div dangerouslySetInnerHTML={{ __html: data.html }} />;
}
