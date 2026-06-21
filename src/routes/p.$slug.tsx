import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";

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
      .select("title, slug, html_content, is_published")
      .eq("slug", data.slug)
      .eq("is_published", true)
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
          { title: loaderData.title },
          { property: "og:title", content: loaderData.title },
        ]
      : [{ title: "Página não encontrada" }],
  }),
  component: PublicSalesPage,
  notFoundComponent: () => <div className="p-10 text-center">Página não encontrada</div>,
  errorComponent: () => <div className="p-10 text-center">Erro ao carregar página</div>,
});

function PublicSalesPage() {
  const { slug } = Route.useParams();
  const { data: page } = useSuspenseQuery(pageOpts(slug));
  if (!page) throw notFound();

  return <div dangerouslySetInnerHTML={{ __html: page.html_content }} />;
}
