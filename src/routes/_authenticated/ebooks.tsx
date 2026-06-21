import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ebooks")({
  component: EbooksList,
});

function EbooksList() {
  const { data } = useQuery({
    queryKey: ["ebooks-list"],
    queryFn: async () => {
      const { data } = await supabase.from("ebooks").select("id,title,niche,created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <DashboardShell title="Meus Ebooks">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex justify-end">
          <Link to="/new-ebook"><Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="mr-2 h-4 w-4" /> Novo</Button></Link>
        </div>
        {data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((e) => (
              <Link key={e.id} to="/ebooks/$id" params={{ id: e.id }} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant transition hover:border-primary/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="h-3 w-3" /> {e.niche}</div>
                <h3 className="mt-2 font-display text-lg font-semibold">{e.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            Nenhum ebook ainda. <Link to="/new-ebook" className="text-primary underline">Gerar agora</Link>.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
