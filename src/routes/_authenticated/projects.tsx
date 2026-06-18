import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects")({
  component: Projects,
});

function Projects() {
  const { data } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <DashboardShell title="Meus Projetos">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Projetos</h2>
          <Link to="/new-project"><Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="mr-2 h-4 w-4" />Novo</Button></Link>
        </div>
        {data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant transition hover:border-primary/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><FolderKanban className="h-3 w-3" /> {p.nicho}</div>
                <h3 className="mt-2 font-display text-lg font-semibold">{p.nome_projeto}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.promessa}</p>
                <div className="mt-4 text-xs text-muted-foreground">{p.quantidade_capitulos} capítulos · {p.idioma}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Você ainda não tem projetos.</p>
            <Link to="/new-project"><Button className="mt-4 bg-gradient-primary text-primary-foreground shadow-glow">Criar primeiro projeto</Button></Link>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
