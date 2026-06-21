import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { BookOpen, Bot, Megaphone, Sparkles, Plus, ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [e, s, c] = await Promise.all([
        supabase.from("ebooks").select("id", { count: "exact", head: true }),
        supabase.from("sales_pages").select("id", { count: "exact", head: true }),
        supabase.from("user_credits").select("credits").maybeSingle(),
      ]);
      return { ebooks: e.count ?? 0, pages: s.count ?? 0, credits: c.data?.credits ?? 0 };
    },
    refetchInterval: 5000,
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-ebooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ebooks")
        .select("id,title,niche,status,created_at, sales_pages(id, slug)")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const cards = [
    { label: "Créditos restantes", value: stats?.credits ?? 0, icon: Sparkles },
    { label: "Ebooks criados", value: stats?.ebooks ?? 0, icon: BookOpen },
    { label: "Páginas de venda", value: stats?.pages ?? 0, icon: Megaphone },
  ];

  return (
    <DashboardShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Bem-vindo de volta 👋</h2>
            <p className="text-sm text-muted-foreground">Gere ebooks e páginas de vendas com IA.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/assistant"><Button variant="outline"><Bot className="mr-2 h-4 w-4" /> Assistente IA</Button></Link>
            <Link to="/new-ebook"><Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="mr-2 h-4 w-4" /> Gerar Ebook</Button></Link>
          </div>
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
            <Link to="/ebooks" className="text-xs text-muted-foreground hover:text-foreground">Ver todos</Link>
          </div>
          {recent && recent.length > 0 ? (
            <ul className="divide-y divide-border">
              {recent.map((p: any) => {
                const sp = p.sales_pages?.[0];
                const url = sp ? `${window.location.origin}/p/${sp.slug}` : null;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-3">
                    <Link to="/ebooks/$id" params={{ id: p.id }} className="min-w-0 flex-1 hover:opacity-80">
                      <div className="truncate font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.niche} · {p.status === "processing" ? "gerando…" : p.status}
                      </div>
                    </Link>
                    {url && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                    <Link to="/ebooks/$id" params={{ id: p.id }}>
                      <Button size="sm" variant="ghost"><ArrowRight className="h-4 w-4" /></Button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum ebook ainda. <Link to="/new-ebook" className="text-primary underline">Gerar o primeiro</Link>.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
