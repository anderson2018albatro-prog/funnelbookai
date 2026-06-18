import { jsPDF } from "jspdf";

type Capitulo = { titulo: string; conteudo: string };
type EbookContent = {
  titulo?: string;
  subtitulo?: string;
  introducao?: string;
  sumario?: string[];
  capitulos?: Capitulo[];
  conclusao?: string;
  cta_final?: string;
};

function sanitize(s: string) {
  return (s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...");
}

export function generateEbookPdfBrowser(opts: {
  titulo: string;
  subtitulo?: string | null;
  conteudo: EbookContent;
  brand?: string;
}) {
  const { titulo, subtitulo, conteudo, brand = "FunnelBook AI" } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const MX = 56;
  const MY = 70;
  const maxW = W - MX * 2;

  // CAPA
  doc.setFillColor(15, 18, 30);
  doc.rect(0, 0, W, H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  const tLines = doc.splitTextToSize(sanitize(titulo), maxW);
  doc.text(tLines, W / 2, H / 2 - 20, { align: "center" });
  if (subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(180, 190, 215);
    const sLines = doc.splitTextToSize(sanitize(subtitulo), maxW - 40);
    doc.text(sLines, W / 2, H / 2 + 30, { align: "center" });
  }
  doc.setFontSize(10);
  doc.setTextColor(140, 150, 175);
  doc.text(brand, W / 2, H - 50, { align: "center" });

  const addFooter = (pageNum: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    doc.text(brand, MX, H - 30);
    doc.text(String(pageNum), W - MX, H - 30, { align: "right" });
  };

  let pageNum = 1;
  const newPage = () => {
    doc.addPage();
    pageNum++;
    doc.setTextColor(20, 20, 30);
    addFooter(pageNum);
    return MY;
  };

  const drawHeading = (text: string, y: number) => {
    if (y > H - MY - 60) y = newPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 30);
    const lines = doc.splitTextToSize(sanitize(text), maxW);
    doc.text(lines, MX, y);
    return y + lines.length * 24 + 8;
  };

  const drawBody = (text: string, y: number, size = 11) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 55);
    const paragraphs = sanitize(text).split(/\n\n+/);
    const lh = size * 1.5;
    for (const p of paragraphs) {
      const lines = doc.splitTextToSize(p, maxW);
      for (const line of lines) {
        if (y > H - MY) y = newPage();
        doc.text(line, MX, y);
        y += lh;
      }
      y += 6;
    }
    return y;
  };

  // SUMÁRIO
  let y = newPage();
  y = drawHeading("Sumário", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 55);
  const sumario =
    conteudo.sumario && conteudo.sumario.length
      ? conteudo.sumario
      : (conteudo.capitulos ?? []).map((c) => c.titulo);
  sumario.forEach((s, i) => {
    if (y > H - MY) y = newPage();
    const line = `${i + 1}. ${sanitize(s)}`;
    const wrapped = doc.splitTextToSize(line, maxW);
    doc.text(wrapped, MX, y);
    y += wrapped.length * 18;
  });

  // INTRODUÇÃO
  if (conteudo.introducao) {
    y = newPage();
    y = drawHeading("Introdução", y);
    drawBody(conteudo.introducao, y);
  }

  // CAPÍTULOS
  (conteudo.capitulos ?? []).forEach((c, i) => {
    y = newPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 110, 200);
    doc.text(`Capítulo ${i + 1}`, MX, y);
    y += 18;
    y = drawHeading(c.titulo, y);
    drawBody(c.conteudo, y);
  });

  // CONCLUSÃO
  if (conteudo.conclusao) {
    y = newPage();
    y = drawHeading("Conclusão", y);
    y = drawBody(conteudo.conclusao, y);
    if (conteudo.cta_final) {
      y += 10;
      y = drawHeading("Próximo passo", y);
      drawBody(conteudo.cta_final, y, 12);
    }
  }

  // footer da capa
  doc.setPage(1);
  // capa não recebe footer

  const filename = `${(titulo || "ebook").replace(/[^\w\-]+/g, "_")}.pdf`;
  doc.save(filename);
}
