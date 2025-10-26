import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { formatCurrency, formatNumber, formatDateTime } from "@/utils/formatters";

type MinimalHeader = {
  codigo: string | null;
  comanda_data: string | null;
  comanda_tipo: string | null;
  observacoes: string | null;
};

export type GroupedItem = {
  nome: string;
  kg: number;
  precoMedio: number;
  total: number;
};

type GenerateParams = {
  header: MinimalHeader;
  groupedItens: GroupedItem[];
  total: number;
};

function sanitizeFilename(input: string): string {
  const base = (input || "comanda").trim();
  const safe = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe || "comanda";
}

function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    const chunk = bytes.subarray(i, end);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export async function generateAndSaveComandaA4Pdf({ header, groupedItens, total }: GenerateParams): Promise<{ filename: string; usedDirectoryName: 'Downloads' | 'Documents' }>{
  const codigo = String(header?.codigo || "comanda");
  const filename = `comanda-${sanitizeFilename(codigo)}.pdf`;

  // Receipt format: 58mm width with dynamic height
  const pdfDoc = await PDFDocument.create();
  const paperWidthMm = 58;
  const marginMm = 3.5;
  const paperWidthPt = mmToPt(paperWidthMm);
  const marginPt = mmToPt(marginMm);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Typography configuration (all sizes in pt)
  const fonts = {
    title: { size: 13, font: helveticaBold, lh: 16 },
    sub: { size: 8.5, font: helvetica, lh: 11 },
    meta: { size: 9.2, font: helvetica, lh: 12 },
    tableHeader: { size: 9, font: helveticaBold, lh: 11 },
    tableBody: { size: 9.2, font: helvetica, lh: 12 },
    total: { size: 11.5, font: helveticaBold, lh: 14 },
    obs: { size: 9, font: helvetica, lh: 11 },
    footer: { size: 10, font: helveticaBold, lh: 12 },
  };

  // Spacing configuration
  const spacing = {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
  };

  const availableWidth = paperWidthPt - marginPt * 2;

  // Helper: truncate text to fit width
  const truncate = (text: string, maxW: number, font: any, size: number): string => {
    if (font.widthOfTextAtSize(text, size) <= maxW) return text;
    let low = 0, high = text.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const sample = text.slice(0, mid) + "…";
      if (font.widthOfTextAtSize(sample, size) <= maxW) low = mid + 1;
      else high = mid;
    }
    return text.slice(0, Math.max(0, low - 1)) + "…";
  };

  // Helper: fit font size down to min to fit width
  const fitSize = (text: string, maxW: number, font: any, size: number, min: number): number => {
    let s = size;
    while (s > min && font.widthOfTextAtSize(text, s) > maxW) s -= 0.2;
    return Math.max(min, s);
  };

  // Compact currency (no symbol)
  const formatCurrencyNoSymbol = (value: number): string => {
    const full = formatCurrency(value || 0);
    return String(full).replace(/[^\d.,-]/g, "");
  };

  // Helper: wrap text into lines
  const wrapText = (text: string, maxW: number, font: any, size: number): string[] => {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxW) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
  };

  // Calculate total page height needed
  const calculateHeight = (): number => {
    let h = marginPt; // top margin
    
    // Header block
    h += fonts.title.lh + spacing.sm;
    h += fonts.sub.lh + spacing.xs;
    h += fonts.sub.lh + spacing.xs;
    h += fonts.sub.lh + spacing.md;
    
    // Metadata (2 lines)
    h += fonts.meta.lh + spacing.xs;
    h += fonts.meta.lh + spacing.md;
    
    // Table header + divider
    h += fonts.tableHeader.lh + spacing.xs;
    h += 1 + spacing.sm; // divider + gap
    
    // Rows (single line per item + divider)
    for (const _ of groupedItens) {
      h += fonts.tableBody.lh + spacing.xs;
      h += 0.5 + spacing.xs; // row divider + gap
    }
    
    // Total section
    h += spacing.sm;
    h += fonts.total.lh + spacing.md;
    
    // Observations (if any)
    if (header?.observacoes) {
      const lines = wrapText(String(header.observacoes), availableWidth, fonts.obs.font, fonts.obs.size);
      h += lines.length * fonts.obs.lh + spacing.sm;
    }
    
    // Footer
    h += fonts.footer.lh + spacing.md;
    h += marginPt; // bottom margin
    
    return Math.max(h, mmToPt(100));
  };

  const pageHeight = calculateHeight();
  const page = pdfDoc.addPage([paperWidthPt, pageHeight]);
  const pageW = page.getSize().width;
  const pageH = page.getSize().height;

  let y = pageH - marginPt;

  // Helper: draw text at cursor position
  const draw = (text: string, style: any, align: 'left' | 'center' | 'right' = 'left') => {
    const { size, font } = style;
    const textW = font.widthOfTextAtSize(text, size);
    let x = marginPt;
    
    if (align === 'center') {
      x = marginPt + (availableWidth - textW) / 2;
    } else if (align === 'right') {
      x = pageW - marginPt - textW;
    }
    
    page.drawText(text, { x, y, size, font, color: rgb(0.1, 0.1, 0.15) });
  };

  const drawMuted = (text: string, style: any, align: 'left' | 'center' | 'right' = 'left') => {
    const { size, font } = style;
    const textW = font.widthOfTextAtSize(text, size);
    let x = marginPt;
    
    if (align === 'center') {
      x = marginPt + (availableWidth - textW) / 2;
    } else if (align === 'right') {
      x = pageW - marginPt - textW;
    }
    
    page.drawText(text, { x, y, size, font, color: rgb(0.42, 0.45, 0.50) });
  };

  const move = (amount: number) => { y -= amount; };

  // === RENDER CONTENT ===

  // Header
  draw("RECICLAGEM PEREQUÊ", fonts.title, 'center');
  move(fonts.title.lh + spacing.sm);
  
  drawMuted("Ubatuba • Perequê Mirim", fonts.sub, 'center');
  move(fonts.sub.lh + spacing.xs);
  
  drawMuted("Av. Marginal, 2504", fonts.sub, 'center');
  move(fonts.sub.lh + spacing.xs);
  
  drawMuted("CNPJ: 45.492.161/0001-88", fonts.sub, 'center');
  move(fonts.sub.lh + spacing.md);

  // Metadata
  const dateTxt = `Data/Hora: ${header?.comanda_data ? formatDateTime(header.comanda_data) : '—'}`;
  const dateW = fonts.meta.font.widthOfTextAtSize(dateTxt, fonts.meta.size);
  const leftMaxForCode = Math.max(0, availableWidth - dateW - 8);
  const codeFull = `Código: ${codigo}`;
  const codeTxt = truncate(codeFull, leftMaxForCode, fonts.meta.font, fonts.meta.size);
  draw(codeTxt, fonts.meta, 'left');
  draw(dateTxt, fonts.meta, 'right');
  move(fonts.meta.lh + spacing.xs);
  
  const tipoTxt = `Tipo: ${String(header?.comanda_tipo || '—').toUpperCase()}`;
  draw(tipoTxt, fonts.meta, 'left');
  move(fonts.meta.lh + spacing.md);

  // Section header
  drawMuted("ITENS", fonts.tableHeader, 'left');
  move(fonts.tableHeader.lh + spacing.xs);
  
  // Column layout (percentages tuned to fit values): 50 | 18 | 14 | 18
  const colW1 = Math.max(50, availableWidth * 0.50);
  const colW2 = Math.max(22, availableWidth * 0.18);
  const colW3 = Math.max(20, availableWidth * 0.14);
  const colW4 = Math.max(22, availableWidth - (colW1 + colW2 + colW3));
  const colX1 = marginPt;
  const colX2 = colX1 + colW1;
  const colX3 = colX2 + colW2;
  const colX4 = colX3 + colW3;

  // Table header
  page.drawText("Material", { x: colX1, y, size: fonts.tableHeader.size, font: fonts.tableHeader.font, color: rgb(0.18, 0.20, 0.26) });
  const precoH = "Preço"; const precoHW = fonts.tableHeader.font.widthOfTextAtSize(precoH, fonts.tableHeader.size);
  page.drawText(precoH, { x: colX2 + (colW2 - precoHW) / 2, y, size: fonts.tableHeader.size, font: fonts.tableHeader.font, color: rgb(0.18, 0.20, 0.26) });
  const kgH = "KG"; const kgHW = fonts.tableHeader.font.widthOfTextAtSize(kgH, fonts.tableHeader.size);
  page.drawText(kgH, { x: colX3 + (colW3 - kgHW) / 2, y, size: fonts.tableHeader.size, font: fonts.tableHeader.font, color: rgb(0.18, 0.20, 0.26) });
  const totalH = "Total"; const totalHW = fonts.tableHeader.font.widthOfTextAtSize(totalH, fonts.tableHeader.size);
  page.drawText(totalH, { x: colX4 + colW4 - totalHW, y, size: fonts.tableHeader.size, font: fonts.tableHeader.font, color: rgb(0.18, 0.20, 0.26) });
  move(fonts.tableHeader.lh + spacing.xs);

  // Divider
  page.drawRectangle({ x: marginPt, y: y - 0.5, width: availableWidth, height: 0.7, color: rgb(0.88, 0.90, 0.94) });
  move(spacing.sm);

  // Rows (single line)
  for (const item of groupedItens) {
    const nome = truncate(String(item.nome || ''), colW1 - 2, fonts.tableBody.font, fonts.tableBody.size);
    const precoTxt = formatCurrencyNoSymbol(Number(item.precoMedio || 0));
    const kgTxt = formatNumber(Number(item.kg || 0), 2);
    const totalTxt = formatCurrency(Number(item.total || 0));

    // Fit numeric sizes if needed
    const precoSize = fitSize(precoTxt, colW2 - 1, fonts.tableBody.font, fonts.tableBody.size, 8.4);
    const kgSize = fitSize(kgTxt, colW3 - 1, fonts.tableBody.font, fonts.tableBody.size, 8.4);
    const totalSize = fitSize(totalTxt, colW4 - 1, helveticaBold, fonts.tableBody.size, 8.4);

    // Draw material
    page.drawText(nome, { x: colX1, y, size: fonts.tableBody.size, font: fonts.tableBody.font, color: rgb(0.1, 0.1, 0.15) });

    // Draw price centered in its column
    const precoW = fonts.tableBody.font.widthOfTextAtSize(precoTxt, precoSize);
    page.drawText(precoTxt, { x: colX2 + (colW2 - precoW) / 2, y, size: precoSize, font: fonts.tableBody.font, color: rgb(0.1, 0.1, 0.15) });

    // Draw KG centered
    const kgW = fonts.tableBody.font.widthOfTextAtSize(kgTxt, kgSize);
    page.drawText(kgTxt, { x: colX3 + (colW3 - kgW) / 2, y, size: kgSize, font: fonts.tableBody.font, color: rgb(0.1, 0.1, 0.15) });

    // Draw total right-aligned
    const totalW2 = helveticaBold.widthOfTextAtSize(totalTxt, totalSize);
    page.drawText(totalTxt, { x: colX4 + colW4 - totalW2, y, size: totalSize, font: helveticaBold, color: rgb(0.1, 0.1, 0.15) });

    move(fonts.tableBody.lh + spacing.xs);

    // Row divider
    page.drawRectangle({ x: marginPt, y: y - 0.25, width: availableWidth, height: 0.5, color: rgb(0.92, 0.93, 0.95) });
    move(spacing.xs);
  }

  // Total
  move(spacing.sm);
  const totalLabel = "TOTAL";
  const totalValue = formatCurrency(Number(total || 0));
  page.drawText(totalLabel, { x: marginPt, y, size: fonts.total.size, font: fonts.total.font, color: rgb(0.1, 0.1, 0.15) });
  const totalW = fonts.total.font.widthOfTextAtSize(totalValue, fonts.total.size);
  page.drawText(totalValue, { x: pageW - marginPt - totalW, y, size: fonts.total.size, font: fonts.total.font, color: rgb(0.1, 0.1, 0.15) });
  move(fonts.total.lh + spacing.md);

  // Observations
  if (header?.observacoes) {
    const lines = wrapText(String(header.observacoes), availableWidth, fonts.obs.font, fonts.obs.size);
    for (const line of lines) {
      drawMuted(line, fonts.obs, 'center');
      move(fonts.obs.lh);
    }
    move(spacing.sm);
  }

  // Footer
  draw("Deus seja louvado", fonts.footer, 'center');

  // Save PDF
  const saveOpts = { useObjectStreams: false } as const;
  const pdfBytes = await pdfDoc.save(saveOpts);
  
  if (!(pdfBytes && pdfBytes.length >= 5 && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50 && pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46 && pdfBytes[4] === 0x2D)) {
    throw new Error('PDF inválido gerado');
  }

  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { filename, usedDirectoryName: 'Downloads' };
  }

  // Android/iOS
  try {
    const status = await Filesystem.checkPermissions();
    const state = (status as any)?.publicStorage || (status as any)?.state;
    if (state && String(state).toLowerCase() !== 'granted') {
      await Filesystem.requestPermissions();
    }
  } catch {}

  const base64Data = bytesToBase64(pdfBytes);
  
  if (!base64Data || base64Data.length === 0) {
    throw new Error('Falha ao converter PDF para base64');
  }

  const writeAndCheckSize = async (directory: Directory, path: string): Promise<void> => {
    await Filesystem.writeFile({ path, data: base64Data, directory, recursive: true });
    const st = await Filesystem.stat({ path, directory });
    const size = Number((st as any)?.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) throw new Error('Arquivo salvo com tamanho zero');
  };

  let usedDirectoryName: 'Downloads' | 'Documents' = 'Downloads';
  try {
    await writeAndCheckSize(Directory.Downloads as any, filename);
  } catch {
    try {
      await writeAndCheckSize(Directory.ExternalStorage as any, `Download/${filename}`);
    } catch {
      try {
        await writeAndCheckSize(Directory.Documents, filename);
        usedDirectoryName = 'Documents';
      } catch {
        await writeAndCheckSize(Directory.Data, filename);
        usedDirectoryName = 'Documents';
      }
    }
  }

  return { filename, usedDirectoryName };
}
