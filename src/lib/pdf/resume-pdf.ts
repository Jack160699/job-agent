import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface ResumePdfInput {
  title: string;
  rawText: string;
  skills?: string[];
  highlights?: string[];
}

export async function generateResumePdf(input: ResumePdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const lineHeight = 14;
  const maxWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function drawLine(text: string, size = 11, useBold = false) {
    const activeFont = useBold ? bold : font;
    const words = text.split(" ");
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const width = activeFont.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size, font: activeFont, color: rgb(0.1, 0.1, 0.1) });
        y -= lineHeight;
        line = word;
      } else {
        line = test;
      }
    }

    if (line) {
      if (y < margin + lineHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size, font: activeFont, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    }
  }

  drawLine(input.title, 16, true);
  y -= 6;

  if (input.highlights?.length) {
    drawLine("Key Highlights", 12, true);
    for (const h of input.highlights.slice(0, 6)) {
      drawLine(`• ${h}`, 10);
    }
    y -= 4;
  }

  if (input.skills?.length) {
    drawLine(`Skills: ${input.skills.slice(0, 20).join(", ")}`, 10);
    y -= 8;
  }

  for (const paragraph of input.rawText.split("\n")) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      y -= 6;
      continue;
    }
    drawLine(trimmed, 10);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function generateCoverLetterPdf(content: string, title: string): Promise<Buffer> {
  return generateResumePdf({ title, rawText: content });
}
