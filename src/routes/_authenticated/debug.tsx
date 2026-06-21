import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/debug")({
  component: DebugPage,
});

function DebugPage() {
  const [log, setLog] = useState<string[]>([]);
  const append = (m: string) => setLog((l) => [`[${new Date().toLocaleTimeString()}] ${m}`, ...l].slice(0, 30));

  const { data: user } = useQuery({
    queryKey: ["debug-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: ebooks } = useQuery({
    queryKey: ["debug-ebooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebooks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) append(`Erro ebooks: ${error.message}`);
      return data ?? [];
    },
  });

  const { data: pages } = useQuery({
    queryKey: ["debug-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_pages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) append(`Erro pages: ${error.message}`);
      return data ?? [];
    },
  });

  const openEbook = (id: string) => {
    const url = `/ebooks/${id}`;
    append(`Abrir ebook → ${url}`);
    try {
      window.location.href = url;
    } catch (e: any) {
      append(`Erro: ${e?.message ?? e}`);
    }
  };

  const testPDF = (eb: any) => {
    try {
      const doc = new jsPDF();
      const title = eb.title || "Ebook";
      doc.setFontSize(18);
      doc.text(title, 14, 20);
      doc.setFontSize(11);
      let raw = "";
      if (typeof eb.content === "string") raw = eb.content;
      else if (eb.content) raw = JSON.stringify(eb.content, null, 2);
      else if (eb.chapters) raw = typeof eb.chapters === "string" ? eb.chapters : JSON.stringify(eb.chapters, null, 2);
      else raw = "(sem conteúdo)";
      const lines = doc.splitTextToSize(raw.slice(0, 5000), 180);
      doc.text(lines, 14, 30);
      doc.save(`${title}.pdf`);
      append(`PDF gerado: ${title}.pdf (${raw.length} chars)`);
    } catch (e: any) {
      append(`Erro PDF: ${e?.message ?? e}`);
    }
  };

  return (
    <DashboardShell title="Diagnóstico">
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">1. Usuário logado</h2>
          <pre className="text-xs">user_id: {user?.id ?? "—"}{"\n"}email: {user?.email ?? "—"}</pre>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">2. Últimos 5 ebooks ({ebooks?.length ?? 0})</h2>
          <div className="space-y-3">
            {ebooks?.map((e: any) => (
              <div key={e.id} className="rounded border p-3 text-xs">
                <div><b>id:</b> {e.id}</div>
                <div><b>title:</b> {e.title}</div>
                <div><b>campos:</b> {Object.keys(e).join(", ")}</div>
                <div><b>content existe:</b> {e.content ? `sim (${typeof e.content})` : "não"}</div>
                <div><b>chapters existe:</b> {e.chapters ? `sim (${typeof e.chapters})` : "não"}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => openEbook(e.id)}>Abrir Ebook</Button>
                  <Button size="sm" variant="outline" onClick={() => testPDF(e)}>Testar PDF</Button>
                </div>
              </div>
            ))}
            {!ebooks?.length && <div className="text-sm text-muted-foreground">Nenhum ebook.</div>}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">3. Últimas 5 páginas de vendas ({pages?.length ?? 0})</h2>
          <div className="space-y-3">
            {pages?.map((p: any) => (
              <div key={p.id} className="rounded border p-3 text-xs">
                <div><b>id:</b> {p.id}</div>
                <div><b>title:</b> {p.title}</div>
                <div><b>slug:</b> {p.slug}</div>
                <div><b>blocks existe:</b> {p.blocks ? `sim (${Array.isArray(p.blocks) ? p.blocks.length + " blocos" : typeof p.blocks})` : "não"}</div>
                <div><b>html_content existe:</b> {p.html_content ? `sim (${p.html_content.length} chars)` : "não"}</div>
                <div className="mt-2 flex gap-2">
                  <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer">
                    <Button size="sm">Abrir Página Pública</Button>
                  </a>
                  <Link to="/sales-pages/$id/edit" params={{ id: p.id }}>
                    <Button size="sm" variant="outline">Editar Página</Button>
                  </Link>
                </div>
              </div>
            ))}
            {!pages?.length && <div className="text-sm text-muted-foreground">Nenhuma página.</div>}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">Log</h2>
          <pre className="max-h-64 overflow-auto text-xs">{log.join("\n") || "(vazio)"}</pre>
        </section>
      </div>
    </DashboardShell>
  );
}
