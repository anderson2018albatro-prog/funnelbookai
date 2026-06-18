import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { ExternalLink, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales-pages")({
  component: SalesList,
});

function SalesList() {
  const { data } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data } = await supabase.from("sales_pages").select("*, projects(id, nome_projeto)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <DashboardShell title="Páginas de Venda">
      <div className="mx-auto max-w-6xl">
        {data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((s: any) => (
              <div key={s.id} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Megaphone className="h-3 w-3" /> {s.projects.nome_projeto}</div>
                <h3 className="mt-2 font-display text-lg font-semibold">{s.headline}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.subheadline}</p>
                <div className="mt-4 flex gap-2">
                  <Link to="/projects/$id" params={{ id: s.projects.id }} className="text-xs text-primary hover:underline">Editar projeto</Link>
                  <Link to="/p/$slug" params={{ slug: s.slug }} target="_blank" className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> /p/{s.slug}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">Nenhuma página criada ainda.</div>
        )}
      </div>
    </DashboardShell>
  );
}
