import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { BookOpen, Copy, ExternalLink, Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ebooks")({
  component: () => <Outlet />,
});

export function EbooksList() {
  return <EbooksListContent />;
}

function EbooksListContent() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ebooks-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ebooks")
        .select("id,title,niche,status,created_at, sales_pages(id, slug, status)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  async function remove(id: string) {
    if (!confirm("Excluir este ebook?")) return;
    const { error } = await supabase.from("ebooks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["ebooks-list"] });
  }

  async function genPage(id: string) {
    const { data, error } = await supabase.functions.invoke("generate-sales-page", { body: { ebookId: id } });
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Geração iniciada");
    qc.invalidateQueries({ queryKey: ["ebooks-list"] });
  }

  return (
    <DashboardShell title="Meus Ebooks">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex justify-end">
          <Link to="/new-ebook"><Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="mr-2 h-4 w-4" /> Novo</Button></Link>
        </div>
        {data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((e: any) => {
              const sp = e.sales_pages?.[0];
              const url = sp ? `${window.location.origin}/p/${sp.slug}` : null;
              return (
                <div key={e.id} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="h-3 w-3" /> {e.niche}
                    {e.status === "processing" && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> gerando</span>}
                    {e.status === "failed" && <span className="ml-2 rounded-full bg-destructive/20 px-2 py-0.5 text-destructive">falhou</span>}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold">{e.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/ebooks/$id", params: { id: e.id } })}>Abrir</Button>
                    {e.status === "completed" && (sp ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url!); toast.success("Link copiado"); }}>
                          <Copy className="mr-1 h-3 w-3" /> Link
                        </Button>
                        <a href={url!} target="_blank" rel="noopener">
                          <Button size="sm" variant="ghost"><ExternalLink className="mr-1 h-3 w-3" /> Página</Button>
                        </a>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => genPage(e.id)}>
                        <Megaphone className="mr-1 h-3 w-3" /> Gerar página
                      </Button>
                    ))}
                    <Button size="sm" variant="destructive" className="ml-auto" onClick={() => remove(e.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            Nenhum ebook ainda. <Link to="/new-ebook" className="text-primary underline">Gerar agora</Link> ou <Link to="/assistant" className="text-primary underline">conversar com o Assistente</Link>.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
