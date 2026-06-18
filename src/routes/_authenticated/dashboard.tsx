import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { BookOpen, Megaphone, FolderKanban, Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [p, e, s] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("ebooks").select("id", { count: "exact", head: true }),
        supabase.from("sales_pages").select("id", { count: "exact", head: true }),
      ]);
      return { projects: p.count ?? 0, ebooks: e.count ?? 0, pages: s.count ?? 0 };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const cards = [
    { label: "Projetos", value: stats?.projects ?? 0, icon: FolderKanban },
    { label: "Ebooks", value: stats?.ebooks ?? 0, icon: BookOpen },
    { label: "Páginas de venda", value: stats?.pages ?? 0, icon: Megaphone },
  ];

  return (
    <DashboardShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Bem-vindo de volta 👋</h2>
            <p className="text-sm text-muted-foreground">Gerencie seus ebooks e funis de venda em um só lugar.</p>
          </div>
          <Link to="/new-project"><Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="mr-2 h-4 w-4" /> Novo projeto</Button></Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 font-display text-3xl font-bold">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-semibold">Projetos recentes</h3>
            <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground">Ver todos</Link>
          </div>
          {recent && recent.length > 0 ? (
            <ul className="divide-y divide-border">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link to="/projects/$id" params={{ id: p.id }} className="flex items-center justify-between py-3 hover:bg-accent/20 -mx-2 px-2 rounded-md">
                    <div>
                      <div className="font-medium">{p.nome_projeto}</div>
                      <div className="text-xs text-muted-foreground">{p.nicho}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum projeto ainda. <Link to="/new-project" className="text-primary underline">Criar o primeiro</Link>.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
