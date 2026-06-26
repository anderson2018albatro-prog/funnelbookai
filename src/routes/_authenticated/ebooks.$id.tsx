import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, Copy, ExternalLink, FileDown, Loader2, Megaphone, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { jsPDF } from "jspdf";

function chapterImageUrl(title: string): string {
  const kw = encodeURIComponent(
    title.replace(/[^\w\sÀ-ÿ]/g, " ").trim().split(/\s+/).slice(0, 4).join(",")
  );
  return `https://source.unsplash.com/1200x400/?${kw}`;
}

async function imgToDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 1200;
        c.height = img.naturalHeight || 400;
        c.getContext("2d")!.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/jpeg", 0.8));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Normalize a field that the AI may return as string, array, or null. */
function asArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => x != null).map((x) => String(x));
  if (typeof v === "string") {
    const parts = v.split(/\n\s*(?:[-*•]\s+|\d+[.)]\s+)/).map((s) => s.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [v];
  }
  return [String(v)];
}

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

/** Accept content as JSON, JSON string, or loose shapes (chapters/capitulos/text/body/conteudo). */
function normalizeEbookContent(raw: unknown): EbookContent {
  if (!raw) return {};
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return { introduction: raw }; }
  }
  if (typeof obj !== "object" || obj === null) return {};

  const chaptersRaw = obj.chapters ?? obj.capitulos ?? obj.chapter_list ?? [];
  const chapters = Array.isArray(chaptersRaw)
    ? chaptersRaw.map((ch: any) => ({
        title: String(ch?.title ?? ch?.titulo ?? ch?.name ?? ""),
        content: String(ch?.content ?? ch?.conteudo ?? ch?.text ?? ch?.body ?? ""),
      }))
    : [];

  const introduction =
    obj.introduction ?? obj.introducao ?? obj.intro ?? obj.text ?? obj.body ?? obj.conteudo ?? "";

  return {
    title: obj.title ?? obj.titulo,
    subtitle: obj.subtitle ?? obj.subtitulo,
    introduction: typeof introduction === "string" ? introduction : "",
    summary: asArray(obj.summary ?? obj.sumario ?? obj.indice),
    chapters,
    conclusion: obj.conclusion ?? obj.conclusao ?? "",
    call_to_action: obj.call_to_action ?? obj.cta ?? obj.chamada ?? "",
    bonus: asArray(obj.bonus ?? obj.bonuses),
    briefing: obj.briefing,
  };
}

function hasRenderableContent(c: EbookContent): boolean {
  return !!(
    c.introduction ||
    c.conclusion ||
    c.call_to_action ||
    (c.chapters && c.chapters.length > 0) ||
    (c.summary && c.summary.length > 0) ||
    (c.bonus && c.bonus.length > 0)
  );
}

export const Route = createFileRoute("/_authenticated/ebooks/$id")({
  component: EbookDetail,
});

function EbookDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "save" | "delete" | "sales" | "pdf">(null);

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
  const [editMode, setEditMode] = useState<"visual" | "json">("visual");
  const [editedContent, setEditedContent] = useState<EbookContent | null>(null);

  useEffect(() => {
    if (ebookQ.data) {
      setTitle(ebookQ.data.title);
      setContentText(JSON.stringify(ebookQ.data.content, null, 2));
    }
  }, [ebookQ.data?.id, ebookQ.data?.status]);

  const c = useMemo(() => normalizeEbookContent(ebookQ.data?.content), [ebookQ.data?.content]);
  const renderable = hasRenderableContent(c);

  useEffect(() => {
    if (c && !editedContent) setEditedContent({ ...c });
  }, [c]);

  const ec = editedContent ?? c;

  function updateChapter(i: number, field: "title" | "content", val: string) {
    setEditedContent((prev) => {
      const chapters = [...(prev?.chapters ?? [])];
      chapters[i] = { ...chapters[i], [field]: val };
      return { ...prev, chapters };
    });
  }

  function addChapter() {
    setEditedContent((prev) => ({
      ...prev,
      chapters: [...(prev?.chapters ?? []), { title: `Capítulo ${(prev?.chapters?.length ?? 0) + 1}`, content: "" }],
    }));
  }

  function removeChapter(i: number) {
    setEditedContent((prev) => {
      const chapters = [...(prev?.chapters ?? [])];
      chapters.splice(i, 1);
      return { ...prev, chapters };
    });
  }

  function moveChapter(i: number, dir: -1 | 1) {
    setEditedContent((prev) => {
      const chapters = [...(prev?.chapters ?? [])];
      const j = i + dir;
      if (j < 0 || j >= chapters.length) return prev;
      [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
      return { ...prev, chapters };
    });
  }

  if (ebookQ.isLoading)
    return (<DashboardShell title="Ebook"><div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></DashboardShell>);
  if (!ebookQ.data)
    return (<DashboardShell title="Ebook"><div className="p-8 text-center">Não encontrado</div></DashboardShell>);

  const ebook = ebookQ.data;
  const status = (ebook as any).status as string;

  async function save() {
    setBusy("save");
    try {
      let parsed: any;
      if (editMode === "json") {
        try { parsed = JSON.parse(contentText); } catch { parsed = ebookQ.data?.content; }
      } else {
        parsed = { ...(ebookQ.data?.content as any), ...editedContent };
      }
      const { error } = await supabase.from("ebooks").update({ title, content: parsed }).eq("id", id);
      if (error) throw error;
      toast.success("Salvo com sucesso!");
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
    const summary = asArray(c.summary);
    const bonus = asArray(c.bonus);
    const chapters = Array.isArray(c.chapters) ? c.chapters : [];
    const md = [
      `# ${c.title ?? title}`,
      c.subtitle ? `## ${c.subtitle}\n` : "",
      c.introduction ? `\n## Introdução\n\n${c.introduction}` : "",
      summary.length ? `\n## Sumário\n\n${summary.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
      ...chapters.map((ch: any, i: number) => `\n## Capítulo ${i + 1}: ${ch?.title ?? ""}\n\n${ch?.content ?? ""}`),
      c.conclusion ? `\n## Conclusão\n\n${c.conclusion}` : "",
      c.call_to_action ? `\n## Chamada para Ação\n\n${c.call_to_action}` : "",
      bonus.length ? `\n## Bônus\n\n${bonus.map((b) => `- ${b}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(md);
    toast.success("Conteúdo copiado");
  }

  async function downloadPDF() {
    setBusy("pdf");
    try {
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
      function newPage() { doc.addPage(); y = margin; }
      function ensure(h: number) { if (y + h > pageH - margin) newPage(); }
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

      const summary = asArray(c.summary);
      const chapters = Array.isArray(c.chapters) ? c.chapters : [];
      const bonus = asArray(c.bonus);

      if (summary.length) {
        writeHeading("Sumário", 22);
        summary.forEach((s, i) => writeBody(`${i + 1}. ${s}`));
        newPage();
      }
      if (c.introduction) {
        writeHeading("Introdução", 20);
        writeBody(c.introduction);
      }
      for (let i = 0; i < chapters.length; i++) {
        const ch: any = chapters[i];
        newPage();
        writeHeading(`Capítulo ${i + 1}: ${ch?.title ?? ""}`, 20);
        if (ch?.title) {
          const imgData = await imgToDataUrl(chapterImageUrl(ch.title));
          if (imgData) {
            const imgH = Math.round(maxW * 400 / 1200);
            ensure(imgH + 16);
            doc.addImage(imgData, "JPEG", margin, y, maxW, imgH);
            y += imgH + 14;
          }
        }
        writeBody(String(ch?.content ?? ""));
      }
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
      if (bonus.length) {
        newPage();
        writeHeading("Bônus", 20);
        bonus.forEach((b) => writeBody(`• ${b}`));
      }

      const total = doc.getNumberOfPages();
      for (let p = 2; p <= total; p++) {
        doc.setPage(p);
        addPageNumber(p - 1);
      }

      const safe = (c.title ?? title).replace(/[^\w\u00C0-\u017F\s-]/g, "").trim().slice(0, 60) || "ebook";
      doc.save(`${safe}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      console.error("[downloadPDF] erro:", e);
      toast.error(`Erro ao gerar PDF: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  }

  const publicUrl = salesQ.data ? `${window.location.origin}/p/${salesQ.data.slug}` : null;
  const salesStatus = (salesQ.data as any)?.status;

  return (
    <DashboardShell title={ebook.title}>
      <div className="mx-auto max-w-4xl space-y-5">
        {status === "processing" && !renderable && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-card p-4 shadow-elegant">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="font-medium">Gerando seu ebook…</div>
              <div className="text-xs text-muted-foreground">Isso leva ~30–60 segundos.</div>
            </div>
          </div>
        )}
        {status === "failed" && !renderable && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/50 bg-card p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <div className="font-medium text-destructive">Falha na geração</div>
              <div className="mt-1 text-xs text-muted-foreground">{(ebook as any).error_message ?? "Tente novamente."}</div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md" />
            <Button onClick={save} disabled={busy === "save"} variant="secondary">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-2">Salvar</span>
            </Button>
            <Button onClick={copyContent} disabled={!renderable} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
            <Button onClick={downloadPDF} disabled={!renderable || busy === "pdf"} variant="outline">
              {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Baixar PDF
            </Button>
            <Button onClick={remove} disabled={busy === "delete"} variant="destructive" className="ml-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          </div>
          {ebook.niche && <p className="mt-3 text-xs text-muted-foreground">Nicho: {ebook.niche} · Status: {status}</p>}
        </div>

        {/* Mode toggle */}
        {renderable && (
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 w-fit">
            <Button size="sm" variant={editMode === "visual" ? "secondary" : "ghost"} onClick={() => setEditMode("visual")} className="h-7 px-3 text-xs">
              <BookOpen className="mr-1 h-3 w-3" /> Editor Visual
            </Button>
            <Button size="sm" variant={editMode === "json" ? "secondary" : "ghost"} onClick={() => setEditMode("json")} className="h-7 px-3 text-xs">
              JSON avançado
            </Button>
          </div>
        )}

        {!renderable && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
            <div className="font-medium">Sem conteúdo renderizável</div>
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              <li>status atual: <code>{String(status)}</code></li>
              <li>ebook.content existe: <code>{String(!!ebook.content)}</code></li>
              <li>tipo: <code>{typeof ebook.content}</code></li>
            </ul>
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-surface p-3 text-xs">
              {JSON.stringify(ebook.content, null, 2)?.slice(0, 2000) ?? "null"}
            </pre>
          </div>
        )}

        {renderable && editMode === "visual" && editedContent && (
          <div className="space-y-4">
            {/* Subtítulo */}
            {ec.subtitle !== undefined && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subtítulo</label>
                <Input value={ec.subtitle ?? ""} onChange={(e) => setEditedContent((p) => ({ ...p, subtitle: e.target.value }))} />
              </div>
            )}

            {/* Introdução */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Introdução</label>
              <Textarea rows={5} value={ec.introduction ?? ""} onChange={(e) => setEditedContent((p) => ({ ...p, introduction: e.target.value }))} className="text-sm" />
            </div>

            {/* Capítulos */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display font-semibold">Capítulos ({ec.chapters?.length ?? 0})</h3>
                <Button size="sm" variant="outline" onClick={addChapter}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar capítulo
                </Button>
              </div>
              <div className="space-y-3">
                {(ec.chapters ?? []).map((ch, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                      <Input
                        value={ch.title}
                        onChange={(e) => updateChapter(i, "title", e.target.value)}
                        className="h-8 font-semibold"
                        placeholder="Título do capítulo"
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveChapter(i, -1)} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveChapter(i, 1)} disabled={i === (ec.chapters?.length ?? 0) - 1}><ChevronDown className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeChapter(i)}><X className="h-3 w-3" /></Button>
                    </div>
                    {ch.title && (
                      <img
                        src={chapterImageUrl(ch.title)}
                        alt={ch.title}
                        className="mb-3 w-full rounded-lg object-cover"
                        style={{ height: 160 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <Textarea
                      rows={6}
                      value={ch.content}
                      onChange={(e) => updateChapter(i, "content", e.target.value)}
                      className="text-sm"
                      placeholder="Conteúdo do capítulo…"
                    />
                  </div>
                ))}
                {(!ec.chapters || ec.chapters.length === 0) && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nenhum capítulo. Clique em "Adicionar capítulo".</p>
                )}
              </div>
            </div>

            {/* Conclusão */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conclusão</label>
              <Textarea rows={4} value={ec.conclusion ?? ""} onChange={(e) => setEditedContent((p) => ({ ...p, conclusion: e.target.value }))} className="text-sm" />
            </div>

            {/* CTA */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chamada para Ação (CTA)</label>
              <Textarea rows={3} value={ec.call_to_action ?? ""} onChange={(e) => setEditedContent((p) => ({ ...p, call_to_action: e.target.value }))} className="text-sm" />
            </div>

            <Button onClick={save} disabled={busy === "save"} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
              {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        )}

        {renderable && editMode === "json" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-2 text-xs text-muted-foreground">Edite o JSON diretamente. Cuidado: alterações incorretas podem quebrar o conteúdo.</p>
            <Textarea rows={16} className="font-mono text-xs" value={contentText} onChange={(e) => setContentText(e.target.value)} />
            <Button onClick={save} disabled={busy === "save"} className="mt-3 w-full bg-gradient-primary text-primary-foreground shadow-glow">
              {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar JSON
            </Button>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Página de Vendas</h3>
              <p className="text-sm text-muted-foreground">
                {salesQ.data
                  ? `Status: ${salesStatus ?? "—"}${publicUrl ? "" : ""}`
                  : "Crie uma página de vendas baseada neste ebook."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {salesQ.data && (
                <Link to="/sales-pages/$id/edit" params={{ id: salesQ.data.id }}>
                  <Button size="sm" variant="secondary"><Pencil className="mr-1 h-4 w-4" /> Editar página</Button>
                </Link>
              )}
              <Button onClick={generateSales} disabled={busy === "sales" || salesStatus === "processing"} className="bg-gradient-primary text-primary-foreground shadow-glow">
                {busy === "sales" || salesStatus === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                <span className="ml-2">{salesQ.data ? "Regerar" : "Gerar Página de Vendas"}</span>
              </Button>
            </div>
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
