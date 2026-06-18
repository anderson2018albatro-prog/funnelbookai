import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ebooks")({
  component: EbooksList,
});

function EbooksList() {
  const { data } = useQuery({
    queryKey: ["ebooks-list"],
    queryFn: async () => {
      const { data } = await supabase.from("ebooks").select("*, projects(id, nome_projeto, nicho)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <DashboardShell title="Ebooks">
      <div className="mx-auto max-w-6xl">
        {data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((e: any) => (
              <Link key={e.id} to="/projects/$id" params={{ id: e.projects.id }} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant transition hover:border-primary/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="h-3 w-3" /> {e.projects.nicho}</div>
                <h3 className="mt-2 font-display text-lg font-semibold">{e.titulo}</h3>
                {e.subtitulo && <p className="mt-1 text-sm text-muted-foreground">{e.subtitulo}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">Nenhum ebook ainda.</div>
        )}
      </div>
    </DashboardShell>
  );
}
