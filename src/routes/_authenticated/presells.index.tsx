import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, MousePointerClick, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PRESELL_TYPE_LABELS } from "@/lib/presell-blocks";

export const Route = createFileRoute("/_authenticated/presells/")({
  component: PresellsList,
});

function PresellsList() {
  const q = useQuery({
    queryKey: ["presells"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presells")
        .select("id,title,slug,presell_type,status,affiliate_url,click_count,created_at,is_published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 4000,
  });

  async function remove(id: string) {
    if (!confirm("Excluir esta presell?")) return;
    const { error } = await supabase.from("presells").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluída"); q.refetch(); }
  }

  return (
    <DashboardShell title="Presells">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Suas Presells</h2>
            <p className="text-sm text-muted-foreground">Bridge pages éticas para afiliados.</p>
          </div>
          <Link to="/presells/new">
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="mr-2 h-4 w-4" /> Nova Presell
            </Button>
          </Link>
        </div>

        {q.isLoading ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : !q.data?.length ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhuma presell ainda. <Link to="/presells/new" className="text-primary underline">Criar a primeira</Link>.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {q.data.map((p: any) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    {p.is_published && (
                      <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">publicada</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{PRESELL_TYPE_LABELS[p.presell_type as keyof typeof PRESELL_TYPE_LABELS] ?? p.presell_type}</span>
                    <span>·</span>
                    <span>{p.status === "processing" ? "gerando…" : p.status}</span>
                    {(p.click_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <MousePointerClick className="h-2.5 w-2.5" />
                        {p.click_count} clique{p.click_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <a href={`/pre/${p.slug}`} target="_blank" rel="noopener">
                  <Button size="sm" variant="ghost" title="Ver presell pública"><ExternalLink className="h-4 w-4" /></Button>
                </a>
                <Link to="/presells/$id/edit" params={{ id: p.id }}>
                  <Button size="sm" variant="ghost"><Pencil className="mr-1 h-3 w-3" /> Editar</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
