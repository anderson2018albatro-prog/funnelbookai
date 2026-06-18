import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ ebookId: z.string().uuid() });

export const generateEbookPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: ebook, error } = await supabase
      .from("ebooks")
      .select("id, titulo, subtitulo, conteudo, project_id, projects!inner(user_id, nome_projeto, nicho)")
      .eq("id", data.ebookId)
      .single();
    if (error || !ebook) throw new Error("Ebook não encontrado");

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const W = 595.28; // A4
    const H = 841.89;
    const MX = 60;
    const MY = 70;
    const maxW = W - MX * 2;

    // Sanitize text to WinAnsi (Helvetica supports Latin-1, not full unicode/emoji)
    const clean = (s: string) => (s ?? "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2013|\u2014/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/[^\x00-\xFF]/g, "");

    const wrap = (text: string, f: any, size: number, width: number): string[] => {
      const lines: string[] = [];
      for (const para of clean(text).split(/\n+/)) {
        const words = para.split(/\s+/);
        let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (f.widthOfTextAtSize(test, size) > width) {
            if (line) lines.push(line);
            line = w;
          } else line = test;
        }
        if (line) lines.push(line);
        lines.push("");
      }
      return lines;
    };

    let page = pdf.addPage([W, H]);
    let y = H - MY;
    const newPage = () => { page = pdf.addPage([W, H]); y = H - MY; };
    const draw = (text: string, opts: { size?: number; bold?: boolean; gap?: number; color?: [number, number, number] } = {}) => {
      const size = opts.size ?? 11;
      const f = opts.bold ? fontBold : font;
      const lh = size * 1.45;
      const lines = wrap(text, f, size, maxW);
      for (const line of lines) {
        if (y - lh < MY) newPage();
        if (line) {
          const c = opts.color ?? [0.1, 0.1, 0.12];
          page.drawText(line, { x: MX, y: y - size, size, font: f, color: rgb(c[0], c[1], c[2]) });
        }
        y -= lh;
      }
      if (opts.gap) y -= opts.gap;
    };

    const c = ebook.conteudo as any;

    // Cover
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.06, 0.07, 0.12) });
    const title = clean(ebook.titulo);
    const titleSize = 32;
    const titleLines = wrap(title, fontBold, titleSize, maxW);
    let ty = H / 2 + 60;
    for (const l of titleLines) {
      const tw = fontBold.widthOfTextAtSize(l, titleSize);
      page.drawText(l, { x: (W - tw) / 2, y: ty, size: titleSize, font: fontBold, color: rgb(1, 1, 1) });
      ty -= titleSize * 1.2;
    }
    if (ebook.subtitulo) {
      const sub = clean(ebook.subtitulo);
      const subLines = wrap(sub, font, 14, maxW - 60);
      ty -= 10;
      for (const l of subLines) {
        const tw = font.widthOfTextAtSize(l, 14);
        page.drawText(l, { x: (W - tw) / 2, y: ty, size: 14, font, color: rgb(0.7, 0.75, 0.85) });
        ty -= 20;
      }
    }
    const brand = "FunnelBook AI";
    const bw = font.widthOfTextAtSize(brand, 10);
    page.drawText(brand, { x: (W - bw) / 2, y: 50, size: 10, font, color: rgb(0.5, 0.55, 0.7) });

    // Sumário
    newPage();
    draw("Sumário", { size: 22, bold: true, gap: 10 });
    if (Array.isArray(c?.sumario)) {
      c.sumario.forEach((s: string, i: number) => draw(`${i + 1}. ${s}`, { size: 12 }));
    } else if (Array.isArray(c?.capitulos)) {
      c.capitulos.forEach((cap: any, i: number) => draw(`${i + 1}. ${cap.titulo}`, { size: 12 }));
    }

    // Introdução
    if (c?.introducao) {
      newPage();
      draw("Introdução", { size: 22, bold: true, gap: 10 });
      draw(c.introducao, { size: 11, gap: 6 });
    }

    // Capítulos
    if (Array.isArray(c?.capitulos)) {
      for (let i = 0; i < c.capitulos.length; i++) {
        const cap = c.capitulos[i];
        newPage();
        draw(`Capítulo ${i + 1}`, { size: 12, bold: true, color: [0.4, 0.45, 0.85] });
        draw(cap.titulo, { size: 22, bold: true, gap: 12 });
        draw(cap.conteudo, { size: 11, gap: 6 });
      }
    }

    // Conclusão
    if (c?.conclusao) {
      newPage();
      draw("Conclusão", { size: 22, bold: true, gap: 10 });
      draw(c.conclusao, { size: 11, gap: 6 });
    }

    const bytes = await pdf.save();
    // Convert to base64 for JSON transport
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(bin);
    return { base64, filename: `${(ebook.titulo || "ebook").replace(/[^\w\-]+/g, "_")}.pdf` };
  });
