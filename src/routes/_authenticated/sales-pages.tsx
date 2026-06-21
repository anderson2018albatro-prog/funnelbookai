import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales-pages")({
  component: SalesList,
});

function SalesList() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data } = await supabase.from("sales_pages").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function remove(id: string) {
    if (!confirm("Excluir esta página?")) return;
    const { error } = await supabase.from("sales_pages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["sales-list"] });
  }

  return (
    <DashboardShell title="Páginas de Venda">
      <div className="mx-auto max-w-6xl">
        {data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((s) => {
              const url = `${window.location.origin}/p/${s.slug}`;
              return (
                <div key={s.id} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Megaphone className="h-3 w-3" /> /p/{s.slug}</div>
                  <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link to="/ebooks/$id" params={{ id: s.ebook_id }} className="text-xs text-primary hover:underline">Abrir ebook</Link>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("URL copiada"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <a href={url} target="_blank" rel="noopener" className="ml-auto">
                      <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3 w-3" /> Abrir</Button>
                    </a>
                    <Button size="sm" variant="destructive" onClick={() => remove(s.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            Nenhuma página criada ainda.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
