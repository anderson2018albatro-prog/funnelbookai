import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, Copy, ExternalLink, FileDown, Loader2, Megaphone, Pencil, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { chapterBannerSvg, coverSvg, dividerSvg, fetchImageAsDataUrl, imageDimensions, paletteFor, svgDataUrl, svgToPngDataUrl } from "@/lib/ebook-art";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
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

type EbookChapter = {
  title: string;
  content: string;
  acao_pratica?: string;
  image_description?: string;
  image_url?: string;
};

type EbookContent = {
  title?: string;
  subtitle?: string;
  cover_promise?: string;
  cover_image_url?: string;
  autor?: string;
  introduction?: string;
  summary?: string[];
  chapters?: EbookChapter[];
  conclusion?: string;
  call_to_action?: string;
  bonus?: string[];
  briefing?: any;
  progress?: { done: number; total: number };
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
        acao_pratica: String(ch?.acao_pratica ?? ch?.practical_action ?? ""),
        image_description: String(ch?.image_description ?? ""),
        image_url: String(ch?.image_url ?? ""),
      }))
    : [];

  const introduction =
    obj.introduction ?? obj.introducao ?? obj.intro ?? obj.text ?? obj.body ?? obj.conteudo ?? "";

  return {
    title: obj.title ?? obj.titulo,
    subtitle: obj.subtitle ?? obj.subtitulo,
    cover_promise: obj.cover_promise ?? "",
    cover_image_url: String(obj.cover_image_url ?? ""),
    autor: obj.autor ?? obj.author ?? obj.briefing?.autor ?? "",
    introduction: typeof introduction === "string" ? introduction : "",
    summary: asArray(obj.summary ?? obj.sumario ?? obj.indice),
    chapters,
    conclusion: obj.conclusion ?? obj.conclusao ?? "",
    call_to_action: obj.call_to_action ?? obj.cta ?? obj.chamada ?? "",
    bonus: asArray(obj.bonus ?? obj.bonuses),
    briefing: obj.briefing,
    progress: obj.progress,
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

  const [regenIdx, setRegenIdx] = useState<number | null>(null);

  // ── Watchdog: geração órfã em "processing" ─────────────────────────────
  // O backend salva progresso (e portanto atualiza updated_at) a cada capítulo.
  // Se o status é "processing" mas o updated_at parou há 8+ min, o processo em
  // background morreu sem conseguir marcar "failed" (wall clock/crash). Chama a
  // ação "reconcile" no servidor, que valida a estagnação, marca failed e
  // devolve o crédito — em vez de deixar o usuário olhando "gerando…" eterno.
  const STALL_MS = 8 * 60_000;
  const rowBeat = (ebookQ.data as any)?.updated_at ?? (ebookQ.data as any)?.created_at;
  const isStalled =
    (ebookQ.data as any)?.status === "processing" &&
    !!rowBeat &&
    Date.now() - new Date(rowBeat).getTime() > STALL_MS;
  const reconcileRef = useRef(false);
  useEffect(() => {
    if (!isStalled || reconcileRef.current) return;
    reconcileRef.current = true;
    supabase.functions
      .invoke("generate-ebook", { body: { action: "reconcile", ebook_id: id } })
      .then(({ data }) => {
        if ((data as any)?.reconciled) {
          toast.error("A geração foi interrompida no servidor. Seu crédito foi devolvido.");
        }
        qc.invalidateQueries({ queryKey: ["ebook", id] });
      })
      .catch(() => {
        // permite nova tentativa no próximo ciclo de polling
        reconcileRef.current = false;
      });
  }, [isStalled, id, qc]);
  // Imagem de capa (IA ou upload) embutida como data URL para o preview SVG e o PDF
  const [coverEmbed, setCoverEmbed] = useState<string | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const url = ec.cover_image_url;
    if (!url) { setCoverEmbed(null); return; }
    let alive = true;
    fetchImageAsDataUrl(url).then((d) => { if (alive) setCoverEmbed(d); });
    return () => { alive = false; };
  }, [ec.cover_image_url]);

  function updateChapter(i: number, field: "title" | "content" | "acao_pratica", val: string) {
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

  async function regenChapter(i: number) {
    setRegenIdx(i);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ebook", {
        body: { action: "regenerate_chapter", ebook_id: id, chapter_index: i },
      });
      if (error) {
        let msg = error.message;
        try { const ctx: any = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* noop */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const ch = (data as any).chapter;
      setEditedContent((prev) => {
        const chapters = [...(prev?.chapters ?? [])];
        chapters[i] = { ...chapters[i], ...ch };
        return { ...prev, chapters };
      });
      qc.invalidateQueries({ queryKey: ["ebook", id] });
      toast.success(`Capítulo ${i + 1} regenerado!`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao regenerar capítulo");
    } finally { setRegenIdx(null); }
  }

  async function uploadCover(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Envie um arquivo de imagem"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem muito grande (máx. 8MB)"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sessão expirada"); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/${id}/cover-upload-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("ebook-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("ebook-assets").getPublicUrl(path);
    setEditedContent((p) => ({ ...p, cover_image_url: data.publicUrl }));
    toast.success("Imagem de capa enviada — clique em Salvar para gravar");
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

      const bookTitle = ec.title ?? title;
      const author = ec.autor ?? "";
      const palette = paletteFor(bookTitle);
      const [pr, pg, pb] = hexToRgb(palette.from);

      function newPage() { doc.addPage(); y = margin; }
      function ensure(h: number) { if (y + h > pageH - margin - 20) newPage(); }
      function writeHeading(text: string, size = 18) {
        ensure(size + 24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.setTextColor(pr, pg, pb);
        const lines = doc.splitTextToSize(text, maxW) as string[];
        doc.text(lines, margin, y);
        doc.setTextColor(0);
        y += lines.length * (size + 4) + 8;
      }
      function writeSubtitle(text: string) {
        ensure(30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13.5);
        doc.setTextColor(pr, pg, pb);
        const lines = doc.splitTextToSize(text, maxW) as string[];
        doc.text(lines, margin, y);
        doc.setTextColor(0);
        y += lines.length * 18 + 6;
      }
      // Corpo em serifa (Times) — contraste tipográfico com títulos em sans bold
      function writeParagraph(text: string) {
        doc.setFont("times", "normal");
        doc.setFontSize(11.5);
        const clean = text.replace(/\n/g, " ").trim();
        if (!clean) return;
        const lines = doc.splitTextToSize(clean, maxW) as string[];
        for (const line of lines) {
          ensure(17);
          doc.text(line, margin, y);
          y += 17;
        }
        y += 10;
      }
      function writeCaption(text: string) {
        if (!text) return;
        ensure(16);
        doc.setFont("times", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(120);
        const lines = doc.splitTextToSize(text, maxW - 80) as string[];
        for (const line of lines) {
          doc.text(line, pageW / 2, y, { align: "center" });
          y += 13;
        }
        doc.setTextColor(0);
        y += 8;
      }
      // Ilustração centralizada, proporção preservada, com legenda opcional
      async function writeIllustration(url: string, caption?: string) {
        try {
          const dataUrl = await fetchImageAsDataUrl(url);
          if (!dataUrl) return;
          const dim = await imageDimensions(dataUrl);
          if (!dim || !dim.w || !dim.h) return;
          let w = maxW, h = (w * dim.h) / dim.w;
          const maxH = 280;
          if (h > maxH) { h = maxH; w = (h * dim.w) / dim.h; }
          ensure(h + 24);
          const fmt = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
          doc.addImage(dataUrl, fmt, margin + (maxW - w) / 2, y, w, h);
          y += h + 10;
          if (caption) writeCaption(caption);
        } catch (e) {
          console.warn("[downloadPDF] ilustração pulada:", url, e);
        }
      }
      async function writeDivider() {
        const png = await svgToPngDataUrl(dividerSvg(bookTitle), 1200, 40);
        if (!png) return;
        const h = Math.round((maxW * 40) / 1200);
        ensure(h + 20);
        doc.addImage(png, "PNG", margin, y, maxW, h);
        y += h + 14;
      }
      // Corpo com suporte a subtítulos "### " (hierarquia tipográfica)
      function writeBody(text: string) {
        const blocks = String(text ?? "").split(/\n\n+/);
        for (const block of blocks) {
          const b = block.trim();
          if (!b) continue;
          if (b.startsWith("### ")) {
            const nl = b.indexOf("\n");
            if (nl > 0) {
              writeSubtitle(b.slice(4, nl).trim());
              writeParagraph(b.slice(nl + 1));
            } else {
              writeSubtitle(b.slice(4).trim());
            }
          } else {
            writeParagraph(b);
          }
        }
        y += 4;
      }
      // Box destacado de "Ação Prática" ao final do capítulo
      function writeActionBox(text: string) {
        const items = String(text ?? "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
        if (!items.length) return;
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "normal");
        const wrapped: string[] = [];
        for (const it of items) {
          wrapped.push(...(doc.splitTextToSize(it, maxW - 40) as string[]));
        }
        const boxH = 34 + wrapped.length * 15 + 14;
        ensure(boxH + 10);
        doc.setFillColor(pr, pg, pb);
        doc.setGState(doc.GState({ opacity: 0.08 }));
        doc.roundedRect(margin, y, maxW, boxH, 8, 8, "F");
        doc.setGState(doc.GState({ opacity: 1 }));
        doc.setDrawColor(pr, pg, pb);
        doc.setLineWidth(1.2);
        doc.roundedRect(margin, y, maxW, boxH, 8, 8, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(pr, pg, pb);
        doc.text("AÇÃO PRÁTICA", margin + 20, y + 24);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(40);
        let by = y + 44;
        for (const line of wrapped) {
          doc.text(line, margin + 20, by);
          by += 15;
        }
        doc.setTextColor(0);
        y += boxH + 16;
      }

      // ── Página 1: capa (gradiente + tipografia + imagem IA/upload se houver) ─
      let coverEmbed: string | undefined;
      if (ec.cover_image_url) {
        coverEmbed = (await fetchImageAsDataUrl(ec.cover_image_url)) ?? undefined;
        if (!coverEmbed) console.warn("[downloadPDF] imagem de capa indisponível, usando capa tipográfica");
      }
      const coverPng = await svgToPngDataUrl(
        coverSvg({ title: bookTitle, subtitle: ec.subtitle, promise: ec.cover_promise, author, seed: bookTitle, imageHref: coverEmbed }),
        1000, 1414,
      );
      if (coverPng) {
        doc.addImage(coverPng, "PNG", 0, 0, pageW, pageH);
      } else {
        doc.setFillColor(pr, pg, pb);
        doc.rect(0, 0, pageW, pageH, "F");
        doc.setTextColor(255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(32);
        doc.text(doc.splitTextToSize(bookTitle, maxW) as string[], pageW / 2, pageH / 2 - 30, { align: "center" });
        doc.setTextColor(0);
      }

      // ── Página 2: reservada para o sumário (preenchida no final, com links) ─
      newPage();
      const tocPage = doc.getNumberOfPages();
      newPage();

      const chapters = Array.isArray(ec.chapters) ? ec.chapters : [];
      const bonus = asArray(ec.bonus);
      const toc: { label: string; page: number }[] = [];

      // ── Conteúdo ──────────────────────────────────────────────────────────
      if (ec.introduction) {
        toc.push({ label: "Introdução", page: doc.getNumberOfPages() });
        writeHeading("Introdução", 20);
        writeBody(ec.introduction);
      }
      for (let i = 0; i < chapters.length; i++) {
        const ch: any = chapters[i];
        newPage();
        toc.push({ label: `Capítulo ${i + 1}: ${ch?.title ?? ""}`, page: doc.getNumberOfPages() });
        const bannerPng = await svgToPngDataUrl(
          chapterBannerSvg({ index: i, title: ch?.title ?? "", imageDescription: ch?.image_description, seed: bookTitle }),
          1200, 340,
        );
        if (bannerPng) {
          const imgH = Math.round(maxW * 340 / 1200);
          doc.addImage(bannerPng, "PNG", margin, y, maxW, imgH);
          y += imgH + 20;
        } else {
          writeHeading(`Capítulo ${i + 1}: ${ch?.title ?? ""}`, 20);
        }
        // Ilustração real do capítulo (gerada por IA) — se falhar, o banner acima já cobre
        if (ch?.image_url) await writeIllustration(ch.image_url, ch?.image_description);
        const chContent = String(ch?.content ?? "").trim();
        if (chContent) writeBody(chContent);
        if (ch?.acao_pratica) writeActionBox(ch.acao_pratica);
        // Separador visual no fim do capítulo (não só quebra de página seca)
        await writeDivider();
      }
      if (ec.conclusion) {
        newPage();
        toc.push({ label: "Conclusão", page: doc.getNumberOfPages() });
        writeHeading("Conclusão", 20);
        writeBody(ec.conclusion);
      }
      if (ec.call_to_action) {
        ensure(80);
        toc.push({ label: "Próximos passos", page: doc.getNumberOfPages() });
        writeHeading("Próximos passos", 18);
        writeBody(ec.call_to_action);
      }
      if (bonus.length) {
        newPage();
        toc.push({ label: "Bônus", page: doc.getNumberOfPages() });
        writeHeading("Bônus", 20);
        bonus.forEach((b) => writeParagraph(`• ${b}`));
      }

      // ── Sumário (página 2) com links clicáveis ────────────────────────────
      doc.setPage(tocPage);
      let ty = margin + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(pr, pg, pb);
      doc.text("Sumário", margin, ty);
      doc.setTextColor(0);
      ty += 44;
      doc.setFontSize(11.5);
      for (const entry of toc) {
        doc.setFont("times", "normal");
        const label = entry.label.length > 70 ? entry.label.slice(0, 69) + "…" : entry.label;
        const pageStr = String(entry.page - 1);
        doc.text(label, margin, ty);
        // Pontilhado entre o título e o número da página
        const labelW = doc.getTextWidth(label);
        const pageStrW = doc.getTextWidth(pageStr);
        const dotStart = margin + labelW + 6;
        const dotEnd = pageW - margin - pageStrW - 8;
        if (dotEnd > dotStart + 10) {
          doc.setTextColor(170);
          let dots = ".";
          while (doc.getTextWidth(dots + " .") < dotEnd - dotStart) dots += " .";
          doc.text(dots, dotStart, ty);
          doc.setTextColor(0);
        }
        doc.text(pageStr, pageW - margin, ty, { align: "right" });
        // linha inteira clicável → página de destino
        doc.link(margin, ty - 11, maxW, 15, { pageNumber: entry.page });
        ty += 21;
        if (ty > pageH - margin) break;
      }

      // ── Cabeçalho e rodapé em todas as páginas internas ───────────────────
      const total = doc.getNumberOfPages();
      const headerTitle = bookTitle.toUpperCase().slice(0, 64);
      for (let p = 2; p <= total; p++) {
        doc.setPage(p);
        // Cabeçalho (a partir da página 3 — o sumário fica limpo)
        if (p >= 3) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(150);
          doc.text(headerTitle, margin, 30);
          doc.setDrawColor(pr, pg, pb);
          doc.setLineWidth(0.8);
          doc.line(margin, 38, pageW - margin, 38);
        }
        // Rodapé: autor + número da página
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(130);
        if (author) doc.text(author, margin, pageH - 24);
        doc.text(String(p - 1), pageW - margin, pageH - 24, { align: "right" });
        doc.setTextColor(0);
      }

      const safe = (ec.title ?? title).replace(/[^\w\u00C0-\u017F\s-]/g, "").trim().slice(0, 60) || "ebook";
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
        {status === "processing" && !isStalled && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-card p-4 shadow-elegant">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <div className="font-medium">
                {c.progress && c.progress.total > 0
                  ? `Gerando capítulo ${Math.min(c.progress.done + 1, c.progress.total)} de ${c.progress.total}…`
                  : "Planejando a estrutura do ebook…"}
              </div>
              <div className="text-xs text-muted-foreground">Geração capítulo a capítulo — o conteúdo aparece abaixo conforme fica pronto.</div>
              {c.progress && c.progress.total > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((c.progress.done / c.progress.total) * 100)}%` }} />
                </div>
              )}
            </div>
          </div>
        )}
        {status === "processing" && isStalled && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/50 bg-card p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <div className="font-medium">A geração parou de responder</div>
              <div className="mt-1 text-xs text-muted-foreground">
                O servidor não envia progresso há vários minutos. Estamos encerrando esta geração e devolvendo seu crédito automaticamente…
              </div>
            </div>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === "failed" && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/50 bg-card p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <div className="font-medium text-destructive">
                {renderable ? "Geração incompleta — seu crédito foi devolvido" : "Falha na geração"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{(ebook as any).error_message ?? "Tente novamente."}</div>
              {renderable && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Os capítulos prontos foram preservados. Use o botão ↻ nos capítulos marcados abaixo para completá-los (grátis) — o PDF é liberado quando todos estiverem completos.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="flex gap-4">
            {renderable && (
              <div className="hidden shrink-0 flex-col items-center gap-1.5 sm:flex">
                <img
                  src={svgDataUrl(coverSvg({ title: ec.title ?? title, subtitle: ec.subtitle, promise: ec.cover_promise, author: ec.autor, seed: ec.title ?? title, imageHref: coverEmbed ?? undefined }))}
                  alt="Capa do ebook"
                  className="w-24 rounded-lg shadow-md"
                />
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => coverFileRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" /> Imagem de capa
                </Button>
              </div>
            )}
            <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-md" />
            <Button onClick={save} disabled={busy === "save"} variant="secondary">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-2">Salvar</span>
            </Button>
            <Button onClick={copyContent} disabled={!renderable} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
            <Button onClick={downloadPDF} disabled={!renderable || busy === "pdf" || status === "failed"} variant="outline"
              title={status === "failed" ? "Complete os capítulos que faltam antes de baixar o PDF" : undefined}>
              {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Baixar PDF
            </Button>
            <Button onClick={remove} disabled={busy === "delete"} variant="destructive" className="ml-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          </div>
          {ebook.niche && <p className="mt-3 text-xs text-muted-foreground">Nicho: {ebook.niche} · Status: {status}</p>}
            </div>
          </div>
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
                {(ec.chapters ?? []).map((ch, i) => {
                  const chFailed = (ch as any).generation_failed === true || (ch.content ?? "").startsWith("[Falha ao gerar") || (status === "failed" && !(ch.content ?? "").trim());
                  return (
                  <div key={i} className={`rounded-xl border p-3 ${chFailed ? "border-amber-500/60 bg-amber-500/5" : "border-border bg-surface"}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                      <Input
                        value={ch.title}
                        onChange={(e) => updateChapter(i, "title", e.target.value)}
                        className="h-8 font-semibold"
                        placeholder="Título do capítulo"
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Regenerar este capítulo com IA (grátis)"
                        onClick={() => regenChapter(i)} disabled={regenIdx !== null}>
                        {regenIdx === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveChapter(i, -1)} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveChapter(i, 1)} disabled={i === (ec.chapters?.length ?? 0) - 1}><ChevronDown className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeChapter(i)}><X className="h-3 w-3" /></Button>
                    </div>
                    {chFailed && (
                      <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        Este capítulo falhou na geração (limite de requisições da IA).
                        <button type="button" className="font-semibold text-amber-700 underline" onClick={() => regenChapter(i)} disabled={regenIdx !== null}>
                          Regenerar agora
                        </button>
                      </div>
                    )}
                    {(ch as any).image_url ? (
                      <img
                        src={(ch as any).image_url}
                        alt={ch.title}
                        className="mb-3 w-full rounded-lg object-cover"
                        style={{ height: 180 }}
                        loading="lazy"
                      />
                    ) : ch.title ? (
                      <img
                        src={svgDataUrl(chapterBannerSvg({ index: i, title: ch.title, imageDescription: (ch as any).image_description, seed: ec.title ?? title }))}
                        alt={ch.title}
                        className="mb-3 w-full rounded-lg object-cover"
                        style={{ height: 160 }}
                      />
                    ) : null}
                    <Textarea
                      rows={6}
                      value={ch.content}
                      onChange={(e) => updateChapter(i, "content", e.target.value)}
                      className="text-sm"
                      placeholder="Conteúdo do capítulo… (use ### para subtítulos de seção)"
                    />
                    <label className="mb-1 mt-2 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">⚡ Ação Prática (box ao final do capítulo)</label>
                    <Textarea
                      rows={2}
                      value={(ch as any).acao_pratica ?? ""}
                      onChange={(e) => updateChapter(i, "acao_pratica", e.target.value)}
                      className="text-sm"
                      placeholder="Passos acionáveis, um por linha…"
                    />
                  </div>
                  );
                })}
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
