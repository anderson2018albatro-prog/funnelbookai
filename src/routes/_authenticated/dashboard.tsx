import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Bot, Copy, ExternalLink, Link2, Loader2, Megaphone,
  MousePointerClick, Pencil, Plus, Sparkles, TrendingUp, Wand2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [e, s, pr, c, clicks] = await Promise.all([
        supabase.from("ebooks").select("id", { count: "exact", head: true }),
        supabase.from("sales_pages").select("id", { count: "exact", head: true }),
        supabase.from("presells").select("id", { count: "exact", head: true }),
        supabase.from("user_credits").select("credits").maybeSingle(),
        supabase.from("presells").select("click_count"),
      ]);
      const totalClicks = (clicks.data ?? []).reduce((sum: number, r: any) => sum + (r.click_count ?? 0), 0);
      return {
        ebooks: e.count ?? 0,
        pages: s.count ?? 0,
        presells: pr.count ?? 0,
        credits: c.data?.credits ?? 0,
        totalClicks,
      };
    },
    refetchInterval: 5000,
  });

  const { data: recentEbooks } = useQuery({
    queryKey: ["recent-ebooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ebooks")
        .select("id,title,niche,status,created_at,sales_pages(id,slug)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const { data: recentPresells } = useQuery({
    queryKey: ["recent-presells"],
    queryFn: async () => {
      const { data } = await supabase
        .from("presells")
        .select("id,title,slug,presell_type,status,click_count,is_published")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const cards = [
    { label: "Créditos restantes", value: stats?.credits ?? 0, icon: Sparkles, color: "text-amber-500" },
    { label: "Ebooks criados", value: stats?.ebooks ?? 0, icon: BookOpen, color: "text-primary" },
    { label: "Páginas de venda", value: stats?.pages ?? 0, icon: Megaphone, color: "text-blue-500" },
    { label: "Cliques nas presells", value: stats?.totalClicks ?? 0, icon: MousePointerClick, color: "text-green-500" },
  ];

  return (
    <DashboardShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Bem-vindo de volta 👋</h2>
            <p className="text-sm text-muted-foreground">Gere ebooks, páginas de vendas e presells com IA.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/assistant">
              <Button variant="outline" size="sm"><Bot className="mr-2 h-4 w-4" /> Assistente IA</Button>
            </Link>
            <Link to="/new-ebook">
              <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Novo Ebook</Button>
            </Link>
            <Link to="/sales-pages/new">
              <Button variant="outline" size="sm"><Wand2 className="mr-2 h-4 w-4" /> Nova Página</Button>
            </Link>
            <Link to="/presells/new">
              <Button className="bg-gradient-primary text-primary-foreground shadow-glow" size="sm">
                <Link2 className="mr-2 h-4 w-4" /> Nova Presell
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="mt-3 font-display text-3xl font-bold">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Ebooks recentes */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display font-semibold">
                <BookOpen className="h-4 w-4 text-primary" /> Ebooks recentes
              </h3>
              <Link to="/ebooks" className="text-xs text-muted-foreground hover:text-foreground">Ver todos</Link>
            </div>
            {recentEbooks && recentEbooks.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentEbooks.map((p: any) => {
                  const sp = p.sales_pages?.[0];
                  const url = sp ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${sp.slug}` : null;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                      <Link to="/ebooks/$id" params={{ id: p.id }} className="min-w-0 flex-1 hover:opacity-80">
                        <div className="truncate text-sm font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.niche} · {p.status === "processing" ? <span className="text-amber-500">gerando…</span> : p.status}
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-1">
                        {url && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Copiar link da página" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                        {sp && (
                          <Link to="/sales-pages/$id/edit" params={{ id: sp.id }}>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Pencil className="mr-1 h-3 w-3" /> Página</Button>
                          </Link>
                        )}
                        <Link to="/ebooks/$id" params={{ id: p.id }}>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Abrir</Button>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum ebook ainda.{" "}
                <Link to="/new-ebook" className="text-primary underline">Gerar o primeiro</Link>.
              </div>
            )}
          </div>

          {/* Presells recentes */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display font-semibold">
                <TrendingUp className="h-4 w-4 text-green-500" /> Presells recentes
              </h3>
              <Link to="/presells" className="text-xs text-muted-foreground hover:text-foreground">Ver todas</Link>
            </div>
            {recentPresells && recentPresells.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentPresells.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{p.title}</span>
                        {p.is_published && (
                          <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">pub.</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{p.status === "processing" ? <span className="text-amber-500">gerando…</span> : p.status}</span>
                        {(p.click_count ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-green-600">
                            <MousePointerClick className="h-2.5 w-2.5" />
                            {p.click_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <a href={`/pre/${p.slug}`} target="_blank" rel="noopener">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><ExternalLink className="h-3 w-3" /></Button>
                      </a>
                      <Link to="/presells/$id/edit" params={{ id: p.id }}>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Pencil className="mr-1 h-3 w-3" /> Editar</Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma presell ainda.{" "}
                <Link to="/presells/new" className="text-primary underline">Criar a primeira</Link>.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
