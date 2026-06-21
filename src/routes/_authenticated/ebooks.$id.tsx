import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { AlertTriangle, Copy, ExternalLink, FileDown, Loader2, Megaphone, Pencil, Save, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";

export const Route = createFileRoute("/_authenticated/ebooks/$id")({
  component: EbookDetail,
});

type EbookContent = {
  title?: string;
  subtitle?: string;
  introduction?: string;
  summary?: string[];
  chapters?: { title: string; content: string }[];
  conclusion?: string;
  call_to_action?: string;
  bonus?: string[];
  briefing?: any;
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
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s === "processing" ? 3000 : false;
    },
  });

  const salesQ = useQuery({
    queryKey: ["ebook-sales", id],
    queryFn: async () => {
      const { data } = await supabase.from("sales_pages").select("*").eq("ebook_id", id).maybeSingle();
      return data;
    },
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s === "processing" ? 3000 : false;
    },
  });

  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  useEffect(() => {
    if (ebookQ.data) {
      setTitle(ebookQ.data.title);
      setContentText(JSON.stringify(ebookQ.data.content, null, 2));
    }
  }, [ebookQ.data?.id, ebookQ.data?.status]);

  if (ebookQ.isLoading)
    return (<DashboardShell title="Ebook"><div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></DashboardShell>);
  if (!ebookQ.data)
    return (<DashboardShell title="Ebook"><div className="p-8 text-center">Não encontrado</div></DashboardShell>);

  const ebook = ebookQ.data;
  const status = (ebook as any).status as string;
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
      if (error) {
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch { /* noop */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Geração da página iniciada!");
      qc.invalidateQueries({ queryKey: ["ebook-sales", id] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  function copyContent() {
    const md = [
      `# ${c.title ?? title}`,
      c.subtitle ? `## ${c.subtitle}\n` : "",
      c.introduction ? `\n## Introdução\n\n${c.introduction}` : "",
      c.summary?.length ? `\n## Sumário\n\n${c.summary.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
      ...(c.chapters ?? []).map((ch, i) => `\n## Capítulo ${i + 1}: ${ch.title}\n\n${ch.content}`),
      c.conclusion ? `\n## Conclusão\n\n${c.conclusion}` : "",
      c.call_to_action ? `\n## Chamada para Ação\n\n${c.call_to_action}` : "",
      c.bonus?.length ? `\n## Bônus\n\n${c.bonus.map((b) => `- ${b}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(md);
    toast.success("Conteúdo copiado");
  }

  function downloadPDF() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    function addPageNumber(n: number) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(String(n), pageW / 2, pageH - 24, { align: "center" });
      doc.setTextColor(0);
    }
    function newPage() {
      doc.addPage();
      y = margin;
    }
    function ensure(h: number) {
      if (y + h > pageH - margin) newPage();
    }
    function writeHeading(text: string, size = 18) {
      ensure(size + 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, maxW) as string[];
      doc.text(lines, margin, y);
      y += lines.length * (size + 4) + 8;
    }
    function writeBody(text: string) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(text, maxW) as string[];
      for (const line of lines) {
        ensure(16);
        doc.text(line, margin, y);
        y += 16;
      }
      y += 6;
    }

    // Capa
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    const tLines = doc.splitTextToSize(c.title ?? title, maxW) as string[];
    doc.text(tLines, pageW / 2, pageH / 2 - 30, { align: "center" });
    if (c.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(16);
      const sLines = doc.splitTextToSize(c.subtitle, maxW) as string[];
      doc.text(sLines, pageW / 2, pageH / 2 + 20, { align: "center" });
    }
    doc.setTextColor(0);
    newPage();

    if (c.summary?.length) {
      writeHeading("Sumário", 22);
      c.summary.forEach((s, i) => writeBody(`${i + 1}. ${s}`));
      newPage();
    }
    if (c.introduction) {
      writeHeading("Introdução", 20);
      writeBody(c.introduction);
    }
    (c.chapters ?? []).forEach((ch, i) => {
      newPage();
      writeHeading(`Capítulo ${i + 1}: ${ch.title}`, 20);
      writeBody(ch.content);
    });
    if (c.conclusion) {
      newPage();
      writeHeading("Conclusão", 20);
      writeBody(c.conclusion);
    }
    if (c.call_to_action) {
      ensure(80);
      writeHeading("Próximos passos", 18);
      writeBody(c.call_to_action);
    }
    if (c.bonus?.length) {
      newPage();
      writeHeading("Bônus", 20);
      c.bonus.forEach((b) => writeBody(`• ${b}`));
    }

    const total = doc.getNumberOfPages();
    for (let p = 2; p <= total; p++) {
      doc.setPage(p);
      addPageNumber(p - 1);
    }

    const safe = (c.title ?? title).replace(/[^\w\u00C0-\u017F\s-]/g, "").trim().slice(0, 60) || "ebook";
    doc.save(`${safe}.pdf`);
  }

  const publicUrl = salesQ.data ? `${window.location.origin}/p/${salesQ.data.slug}` : null;
  const salesStatus = (salesQ.data as any)?.status;

  return (
    <DashboardShell title={ebook.title}>
      <div className="mx-auto max-w-4xl space-y-5">
        {status === "processing" && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-card p-4 shadow-elegant">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="font-medium">Gerando seu ebook…</div>
              <div className="text-xs text-muted-foreground">Isso leva ~30–60 segundos. Você pode sair desta tela; o resultado é salvo automaticamente.</div>
            </div>
          </div>
        )}
        {status === "failed" && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/50 bg-card p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <div className="font-medium text-destructive">Falha na geração</div>
              <div className="mt-1 text-xs text-muted-foreground">{(ebook as any).error_message ?? "Tente novamente."}</div>
              <p className="mt-1 text-xs text-muted-foreground">Seu crédito foi devolvido. Você pode tentar gerar outro ebook.</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md" />
            <Button onClick={save} disabled={busy === "save" || status !== "completed"} variant="secondary">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-2">Salvar</span>
            </Button>
            <Button onClick={copyContent} disabled={status !== "completed"} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
            <Button onClick={remove} disabled={busy === "delete"} variant="destructive" className="ml-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          </div>
          {ebook.niche && <p className="mt-3 text-xs text-muted-foreground">Nicho: {ebook.niche}</p>}
        </div>

        {status === "completed" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            {c.subtitle && <p className="text-base font-medium text-primary">{c.subtitle}</p>}
            {c.introduction && (
              <>
                <h3 className="mt-4 font-display text-lg font-semibold">Introdução</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.introduction}</p>
              </>
            )}
            {c.summary?.length ? (
              <>
                <h3 className="mt-6 font-display text-lg font-semibold">Sumário</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {c.summary.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </>
            ) : null}
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
            {c.call_to_action && (
              <>
                <h3 className="mt-6 font-display text-lg font-semibold">Chamada para Ação</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.call_to_action}</p>
              </>
            )}
            {c.bonus?.length ? (
              <>
                <h3 className="mt-6 font-display text-lg font-semibold">Bônus sugeridos</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {c.bonus.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </>
            ) : null}
          </div>
        )}

        {status === "completed" && (
          <details className="rounded-2xl border border-border bg-card p-5">
            <summary className="cursor-pointer font-medium">Editar conteúdo (JSON avançado)</summary>
            <Textarea rows={12} className="mt-3 font-mono text-xs" value={contentText} onChange={(e) => setContentText(e.target.value)} />
          </details>
        )}

        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Página de Vendas</h3>
              <p className="text-sm text-muted-foreground">
                {salesStatus === "processing" ? "Gerando página…" :
                 salesStatus === "failed" ? `Falhou: ${(salesQ.data as any)?.error_message ?? ""}` :
                 salesQ.data ? "Gerada e publicada." : "Crie uma página de vendas baseada neste ebook."}
              </p>
            </div>
            <Button onClick={generateSales} disabled={busy === "sales" || status !== "completed" || salesStatus === "processing"} className="bg-gradient-primary text-primary-foreground shadow-glow">
              {busy === "sales" || salesStatus === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              <span className="ml-2">{salesQ.data ? "Regerar" : "Gerar Página de Vendas"}</span>
            </Button>
          </div>

          {publicUrl && salesStatus === "completed" && (
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
