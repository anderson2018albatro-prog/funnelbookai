import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debug")({
  component: DebugPage,
});

function DebugPage() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  const append = (m: string) => setLog((l) => [`[${new Date().toLocaleTimeString()}] ${m}`, ...l].slice(0, 50));

  const { data: user } = useQuery({
    queryKey: ["debug-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: credits } = useQuery({
    queryKey: ["debug-credits"],
    queryFn: async () => {
      const { data } = await supabase.from("user_credits").select("credits").maybeSingle();
      return data?.credits ?? 0;
    },
  });

  const { data: ebooks, refetch: refetchEbooks } = useQuery({
    queryKey: ["debug-ebooks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ebooks").select("*").order("created_at", { ascending: false }).limit(5);
      if (error) append(`Erro ebooks: ${error.message}`);
      return data ?? [];
    },
  });

  const { data: pages, refetch: refetchPages } = useQuery({
    queryKey: ["debug-pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_pages").select("*").order("created_at", { ascending: false }).limit(5);
      if (error) append(`Erro pages: ${error.message}`);
      return data ?? [];
    },
  });

  const { data: presells, refetch: refetchPresells } = useQuery({
    queryKey: ["debug-presells"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presells").select("*").order("created_at", { ascending: false }).limit(5);
      if (error) append(`Erro presells: ${error.message}`);
      return data ?? [];
    },
  });

  async function mockEbook() {
    setBusy("ebook");
    try {
      append("Gerando ebook MOCK (sem crédito)...");
      const { data, error } = await supabase.functions.invoke("generate-ebook", {
        body: { tema: "Produtividade e Foco para Empreendedores", publico_alvo: "Empreendedores digitais", promessa: "Dobrar produtividade em 21 dias", capitulos: 5, test_mode: true },
      });
      if (error) { append(`Erro: ${error.message}`); return; }
      const d = data as any;
      if (d?.error) { append(`Erro: ${d.error}`); return; }
      append(`✅ Ebook mock criado! ID: ${d.ebookId}`);
      toast.success("Ebook mock criado!");
      await refetchEbooks();
    } finally { setBusy(null); }
  }

  async function mockSalesPage() {
    setBusy("sales");
    try {
      append("Gerando página de vendas MOCK (sem crédito)...");
      const { data, error } = await supabase.functions.invoke("generate-sales-page-from-prompt", {
        body: { product_name: "Curso de Marketing Digital", niche: "Marketing Digital", target_audience: "Empreendedores iniciantes", offer: "R$ 197 à vista", test_mode: true },
      });
      if (error) { append(`Erro: ${error.message}`); return; }
      const d = data as any;
      if (d?.error) { append(`Erro: ${d.error}`); return; }
      append(`✅ Página mock criada! ID: ${d.salesPageId}`);
      toast.success("Página de vendas mock criada!");
      await refetchPages();
    } finally { setBusy(null); }
  }

  async function mockPresell() {
    setBusy("presell");
    try {
      append("Gerando presell MOCK (sem crédito)...");
      const { data, error } = await supabase.functions.invoke("generate-presell", {
        body: { affiliate_url: "https://exemplo.com/afiliado?ref=mock", niche: "Emagrecimento", target_audience: "Mulheres 30-50 anos", presell_type: "review", test_mode: true },
      });
      if (error) { append(`Erro: ${error.message}`); return; }
      const d = data as any;
      if (d?.error) { append(`Erro: ${d.error}`); return; }
      append(`✅ Presell mock criada! ID: ${d.presellId}`);
      toast.success("Presell mock criada!");
      await refetchPresells();
    } finally { setBusy(null); }
  }

  async function mockSalesFromEbook() {
    setBusy("sales-from-ebook");
    try {
      const latestEbook = ebooks?.[0];
      if (!latestEbook) { append("Nenhum ebook disponível. Gere um primeiro."); return; }
      if ((latestEbook as any).status !== "completed") { append("Ebook ainda não completo."); return; }
      append(`Gerando página de vendas mock do ebook "${latestEbook.title}"...`);
      const { data, error } = await supabase.functions.invoke("generate-sales-page", {
        body: { ebookId: latestEbook.id, test_mode: true },
      });
      if (error) { append(`Erro: ${error.message}`); return; }
      const d = data as any;
      if (d?.error) { append(`Erro: ${d.error}`); return; }
      append(`✅ Página mock do ebook criada! ID: ${d.pageId}`);
      toast.success("Página mock do ebook criada!");
      await refetchPages();
    } finally { setBusy(null); }
  }

  function refetchAll() { refetchEbooks(); refetchPages(); refetchPresells(); qc.invalidateQueries({ queryKey: ["debug-credits"] }); }

  return (
    <DashboardShell title="Diagnóstico & Teste Mock">
      <div className="mx-auto max-w-5xl space-y-6 p-4">

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">1. Usuário & Créditos</h2>
          <pre className="text-xs">user_id: {user?.id ?? "—"}{"\n"}email: {user?.email ?? "—"}{"\n"}créditos: {credits ?? "—"}</pre>
          <Button size="sm" className="mt-2" variant="outline" onClick={refetchAll}>↻ Atualizar tudo</Button>
        </section>

        <section className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-4">
          <h2 className="mb-3 font-bold text-green-800 dark:text-green-300">2. Gerar MOCK (sem gastar crédito de IA)</h2>
          <p className="mb-3 text-xs text-green-700 dark:text-green-400">Use estes botões para testar o fluxo completo sem chamar IA e sem gastar créditos.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!!busy} onClick={mockEbook} className="bg-green-600 hover:bg-green-700 text-white">
              {busy === "ebook" ? "Gerando..." : "📚 Gerar Ebook Mock"}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={mockSalesPage} className="bg-green-600 hover:bg-green-700 text-white">
              {busy === "sales" ? "Gerando..." : "🛒 Gerar Página Mock"}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={mockSalesFromEbook} className="bg-green-600 hover:bg-green-700 text-white">
              {busy === "sales-from-ebook" ? "Gerando..." : "📚🛒 Página do Último Ebook Mock"}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={mockPresell} className="bg-green-600 hover:bg-green-700 text-white">
              {busy === "presell" ? "Gerando..." : "🔗 Gerar Presell Mock"}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">3. Últimos 5 Ebooks ({ebooks?.length ?? 0})</h2>
          <div className="space-y-3">
            {ebooks?.map((e: any) => (
              <div key={e.id} className="rounded border p-3 text-xs">
                <div><b>Título:</b> {e.title}</div>
                <div><b>Status:</b> <span className={e.status === "completed" ? "text-green-600" : e.status === "failed" ? "text-red-500" : "text-yellow-500"}>{e.status}</span></div>
                <div><b>content:</b> {e.content ? `✅ (${typeof e.content})` : "❌ null"}</div>
                {e.error_message && <div className="text-red-500"><b>Erro:</b> {e.error_message}</div>}
                <div className="mt-2 flex gap-2">
                  <a href={`/ebooks/${e.id}`}><Button size="sm">Abrir Ebook</Button></a>
                </div>
              </div>
            ))}
            {!ebooks?.length && <div className="text-sm text-muted-foreground">Nenhum ebook.</div>}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">4. Últimas 5 Páginas de Vendas ({pages?.length ?? 0})</h2>
          <div className="space-y-3">
            {pages?.map((p: any) => (
              <div key={p.id} className="rounded border p-3 text-xs">
                <div><b>Título:</b> {p.title}</div>
                <div><b>Slug:</b> {p.slug}</div>
                <div><b>Status:</b> <span className={p.status === "completed" ? "text-green-600" : p.status === "failed" ? "text-red-500" : "text-yellow-500"}>{p.status}</span></div>
                <div><b>blocks:</b> {p.blocks ? "✅" : "❌"} &nbsp;<b>html:</b> {p.html_content ? `✅ (${p.html_content.length} chars)` : "❌"}</div>
                {p.error_message && <div className="text-red-500"><b>Erro:</b> {p.error_message}</div>}
                <div className="mt-2 flex gap-2">
                  <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer"><Button size="sm">Abrir Página</Button></a>
                  <Link to="/sales-pages/$id/edit" params={{ id: p.id }}><Button size="sm" variant="outline">Editar</Button></Link>
                </div>
              </div>
            ))}
            {!pages?.length && <div className="text-sm text-muted-foreground">Nenhuma página.</div>}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">5. Últimas 5 Presells ({presells?.length ?? 0})</h2>
          <div className="space-y-3">
            {presells?.map((p: any) => (
              <div key={p.id} className="rounded border p-3 text-xs">
                <div><b>Título:</b> {p.title}</div>
                <div><b>Tipo:</b> {p.presell_type} &nbsp;<b>Slug:</b> {p.slug}</div>
                <div><b>Status:</b> <span className={p.status === "completed" ? "text-green-600" : p.status === "failed" ? "text-red-500" : "text-yellow-500"}>{p.status}</span></div>
                <div><b>affiliate_url:</b> {p.affiliate_url}</div>
                <div><b>click_count:</b> {p.click_count ?? 0} &nbsp;<b>blocks:</b> {p.blocks ? "✅" : "❌"}</div>
                {p.error_message && <div className="text-red-500"><b>Erro:</b> {p.error_message}</div>}
                <div className="mt-2 flex gap-2">
                  <a href={`/pre/${p.slug}`} target="_blank" rel="noreferrer"><Button size="sm">Abrir Presell</Button></a>
                  <a href={`/presells/${p.id}/edit`}><Button size="sm" variant="outline">Editar</Button></a>
                </div>
              </div>
            ))}
            {!presells?.length && <div className="text-sm text-muted-foreground">Nenhuma presell.</div>}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-bold">Log de ações</h2>
          <pre className="max-h-64 overflow-auto text-xs bg-muted p-3 rounded">{log.join("\n") || "(vazio)"}</pre>
        </section>
      </div>
    </DashboardShell>
  );
}
