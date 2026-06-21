import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Megaphone, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ebooks/$id")({
  component: EbookDetail,
});

type EbookContent = {
  title?: string;
  subtitle?: string;
  description?: string;
  summary?: string[];
  chapters?: { title: string; content: string }[];
  conclusion?: string;
  bonus?: string;
};

function EbookDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "save" | "delete" | "sales">(null);

  const ebookQ = useQuery({
    queryKey: ["ebook", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ebooks").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const salesQ = useQuery({
    queryKey: ["ebook-sales", id],
    queryFn: async () => {
      const { data } = await supabase.from("sales_pages").select("*").eq("ebook_id", id).maybeSingle();
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  useEffect(() => {
    if (ebookQ.data) {
      setTitle(ebookQ.data.title);
      setContentText(JSON.stringify(ebookQ.data.content, null, 2));
    }
  }, [ebookQ.data]);

  if (ebookQ.isLoading) return <DashboardShell title="Ebook"><div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></DashboardShell>;
  if (!ebookQ.data) return <DashboardShell title="Ebook"><div className="p-8 text-center">Não encontrado</div></DashboardShell>;

  const ebook = ebookQ.data;
  const c = (ebook.content ?? {}) as EbookContent;

  async function save() {
    setBusy("save");
    try {
      let parsed: any = c;
      try { parsed = JSON.parse(contentText); } catch { /* keep object */ }
      const { error } = await supabase.from("ebooks").update({ title, content: parsed }).eq("id", id);
      if (error) throw error;
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["ebook", id] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  async function remove() {
    if (!confirm("Excluir este ebook e sua página de vendas?")) return;
    setBusy("delete");
    try {
      const { error } = await supabase.from("ebooks").delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído");
      navigate({ to: "/ebooks" });
    } catch (e: any) { toast.error(e.message); setBusy(null); }
  }

  async function generateSales() {
    setBusy("sales");
    try {
      const { data, error } = await supabase.functions.invoke("generate-sales-page", { body: { ebookId: id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Página de vendas gerada!");
      qc.invalidateQueries({ queryKey: ["ebook-sales", id] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  function copyContent() {
    const md = [
      `# ${c.title ?? title}`,
      c.subtitle ? `## ${c.subtitle}\n` : "",
      c.description ? `${c.description}\n` : "",
      ...(c.chapters ?? []).map((ch) => `\n## ${ch.title}\n\n${ch.content}`),
      c.conclusion ? `\n## Conclusão\n\n${c.conclusion}` : "",
      c.bonus ? `\n## Bônus\n\n${c.bonus}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(md);
    toast.success("Conteúdo copiado");
  }

  const publicUrl = salesQ.data ? `${window.location.origin}/p/${salesQ.data.slug}` : null;

  return (
    <DashboardShell title={ebook.title}>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md" />
            <Button onClick={save} disabled={busy === "save"} variant="secondary">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-2">Salvar</span>
            </Button>
            <Button onClick={copyContent} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
            <Button onClick={remove} disabled={busy === "delete"} variant="destructive" className="ml-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          </div>
          {ebook.niche && <p className="mt-3 text-xs text-muted-foreground">Nicho: {ebook.niche}</p>}
        </div>

        {/* Render conteúdo */}
        <div className="rounded-2xl border border-border bg-card p-5">
          {c.subtitle && <p className="text-base font-medium text-primary">{c.subtitle}</p>}
          {c.description && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{c.description}</p>}

          {c.summary && c.summary.length > 0 && (
            <>
              <h3 className="mt-6 font-display text-lg font-semibold">Sumário</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {c.summary.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </>
          )}

          {(c.chapters ?? []).map((ch, i) => (
            <div key={i} className="mt-6">
              <h3 className="font-display text-lg font-semibold">Capítulo {i + 1}: {ch.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{ch.content}</p>
            </div>
          ))}

          {c.conclusion && (
            <>
              <h3 className="mt-6 font-display text-lg font-semibold">Conclusão</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.conclusion}</p>
            </>
          )}

          {c.bonus && (
            <>
              <h3 className="mt-6 font-display text-lg font-semibold">Bônus</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.bonus}</p>
            </>
          )}
        </div>

        {/* Edição JSON avançado */}
        <details className="rounded-2xl border border-border bg-card p-5">
          <summary className="cursor-pointer font-medium">Editar conteúdo (JSON avançado)</summary>
          <Textarea rows={12} className="mt-3 font-mono text-xs" value={contentText} onChange={(e) => setContentText(e.target.value)} />
        </details>

        {/* Sales page */}
        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Página de Vendas</h3>
              <p className="text-sm text-muted-foreground">
                {salesQ.data ? "Gerada e publicada." : "Crie uma página de vendas baseada neste ebook."}
              </p>
            </div>
            <Button onClick={generateSales} disabled={busy === "sales"} className="bg-gradient-primary text-primary-foreground shadow-glow">
              {busy === "sales" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              <span className="ml-2">{salesQ.data ? "Regerar" : "Gerar"}</span>
            </Button>
          </div>

          {publicUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-3">
              <code className="break-all text-xs">{publicUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("URL copiada"); }}>
                <Copy className="h-3 w-3" />
              </Button>
              <a href={publicUrl} target="_blank" rel="noopener" className="ml-auto">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3 w-3" /> Abrir</Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
