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

function bytesToBase64(bytes: Uint8Array): string {
  // Conversão robusta de bytes para base64 usando chunks para evitar estouro de pilha
  let binary = "";
  const chunkSize = 8192; // 8KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    const chunk = bytes.subarray(i, end);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// (Unused converter kept for potential future debug)
function base64ToBytes(b64: string): Uint8Array {
  try {
    const binary = atob(b64.replace(/\s+/g, ""));
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return new Uint8Array();
  }
}

export async function generateAndSaveComandaA4Pdf({ header, groupedItens, total }: GenerateParams): Promise<{ filename: string; usedDirectoryName: 'Downloads' | 'Documents' }>{
  const codigo = String(header?.codigo || "comanda");
  const filename = `comanda-${sanitizeFilename(codigo)}.pdf`;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const pageSize: [number, number] = [595.28, 841.89]; // A4 in points
  let page = pdfDoc.addPage(pageSize);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Margins and layout
  const marginLeft = 40;
  const marginRight = 40;
  const marginTop = 48;
  const marginBottom = 48;
  const width = pageSize[0];
  const height = pageSize[1];
  let cursorY = height - marginTop;

  const drawText = (text: string, opts: { x?: number; y?: number; size?: number; font?: any; color?: any; align?: 'left' | 'center' | 'right'; maxWidth?: number }) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? helvetica;
    const color = opts.color ?? rgb(0.066, 0.094, 0.153); // #111827
    const maxWidth = opts.maxWidth ?? (width - marginLeft - marginRight);
    let x = opts.x ?? marginLeft;
    let y = opts.y ?? cursorY;
    const textWidth = font.widthOfTextAtSize(text, size);
    if (opts.align === 'center') {
      x = marginLeft + (maxWidth - textWidth) / 2;
    } else if (opts.align === 'right') {
      x = marginLeft + (maxWidth - textWidth);
    }
    page.drawText(text, { x, y, size, font, color, maxWidth });
  };

  const moveY = (dy: number) => { cursorY -= dy; };

  // Header
  drawText("RECICLAGEM PEREQUÊ", { size: 18, font: helveticaBold, align: 'center' });
  moveY(22);
  drawText("Ubatuba • Perequê Mirim", { size: 10, align: 'center', color: rgb(0.42, 0.45, 0.50) });
  moveY(14);
  drawText("Av. Marginal, 2504", { size: 10, align: 'center', color: rgb(0.42, 0.45, 0.50) });
  moveY(14);
  drawText("CNPJ: 45.492.161/0001-88", { size: 10, align: 'center', color: rgb(0.42, 0.45, 0.50) });
  moveY(18);

  // Metadata (Código / Data/Hora / Tipo)
  const metaSize = 10;
  const metaGap = 14;
  const codeTxt = `Código: ${codigo}`;
  const dateTxt = `Data/Hora: ${header?.comanda_data ? formatDateTime(header.comanda_data) : '—'}`;
  drawText(codeTxt, { size: metaSize, align: 'left' });
  drawText(dateTxt, { size: metaSize, align: 'right' });
  moveY(metaGap);
  const tipoTxt = `Tipo: ${String(header?.comanda_tipo || '—').toUpperCase()}`;
  drawText(tipoTxt, { size: metaSize, align: 'left' });
  moveY(18);

  // Table header
  const availableWidth = width - marginLeft - marginRight;
  const colW3 = 50; // KG
  const colW4 = 60; // Total
  const colW2 = 55; // Preço
  const colW1 = Math.max(80, availableWidth - (colW2 + colW3 + colW4));
  const colX1 = marginLeft;
  const colX2 = colX1 + colW1;
  const colX3 = colX2 + colW2;
  const colX4 = colX3 + colW3;

  const headerSize = 10;
  page.drawText("Material", { x: colX1, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
  const kgHeader = "KG";
  const kgWidth = helveticaBold.widthOfTextAtSize(kgHeader, headerSize);
  page.drawText(kgHeader, { x: colX2 + (colW2 - kgWidth) / 2, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
  const precoHeader = "Preço";
  const precoWidth = helveticaBold.widthOfTextAtSize(precoHeader, headerSize);
  page.drawText(precoHeader, { x: colX3 + (colW3 - precoWidth) / 2, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
  const totalHeader = "Total";
  const totalWidth = helveticaBold.widthOfTextAtSize(totalHeader, headerSize);
  page.drawText(totalHeader, { x: colX4 + colW4 - totalWidth, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
  moveY(12);
  // Horizontal divider
  page.drawRectangle({ x: marginLeft, y: cursorY - 0.25, width: availableWidth, height: 0.5, color: rgb(0.90, 0.91, 0.93) });
  moveY(6);

  // Helpers for table rows
  const bodySize = 10;
  const lineGap = 4;

  function truncateToWidth(text: string, maxWidth: number, font: any, size: number): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    const ellipsis = "…";
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const sample = text.slice(0, mid) + ellipsis;
      if (font.widthOfTextAtSize(sample, size) <= maxWidth) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    const result = text.slice(0, Math.max(0, low - 1)) + ellipsis;
    return result;
  }

  //

  // Render rows
  for (const g of groupedItens) {
    if (cursorY < marginBottom + 24) {
      page = pdfDoc.addPage(pageSize);
      cursorY = height - marginTop;
      // Re-draw header row on new page
      page.drawText("Material", { x: colX1, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
      const kgW = helveticaBold.widthOfTextAtSize(kgHeader, headerSize);
      page.drawText(kgHeader, { x: colX2 + (colW2 - kgW) / 2, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
      const precoW = helveticaBold.widthOfTextAtSize(precoHeader, headerSize);
      page.drawText(precoHeader, { x: colX3 + (colW3 - precoW) / 2, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
      const totalW2 = helveticaBold.widthOfTextAtSize(totalHeader, headerSize);
      page.drawText(totalHeader, { x: colX4 + colW4 - totalW2, y: cursorY, size: headerSize, font: helveticaBold, color: rgb(0.22, 0.25, 0.31) });
      moveY(12);
      page.drawRectangle({ x: marginLeft, y: cursorY - 0.25, width: availableWidth, height: 0.5, color: rgb(0.90, 0.91, 0.93) });
      moveY(6);
    }

    const nomeTxt = truncateToWidth(String(g.nome || ''), colW1 - 2, helvetica, bodySize);
    const kgTxt = formatNumber(Number(g.kg || 0), 2);
    const precoTxt = formatCurrency(Number(g.precoMedio || 0));
    const totalTxt = formatCurrency(Number(g.total || 0));

    page.drawText(nomeTxt, { x: colX1, y: cursorY, size: bodySize, font: helvetica, color: rgb(0.066, 0.094, 0.153) });
    const kgTxtW = helvetica.widthOfTextAtSize(kgTxt, bodySize);
    page.drawText(kgTxt, { x: colX2 + (colW2 - kgTxtW) / 2, y: cursorY, size: bodySize, font: helvetica, color: rgb(0.066, 0.094, 0.153) });
    const precoTxtW = helvetica.widthOfTextAtSize(precoTxt, bodySize);
    page.drawText(precoTxt, { x: colX3 + (colW3 - precoTxtW) / 2, y: cursorY, size: bodySize, font: helvetica, color: rgb(0.066, 0.094, 0.153) });
    const totalTxtW = helvetica.widthOfTextAtSize(totalTxt, bodySize);
    page.drawText(totalTxt, { x: colX4 + colW4 - totalTxtW, y: cursorY, size: bodySize, font: helveticaBold, color: rgb(0.066, 0.094, 0.153) });
    moveY(bodySize + lineGap);
    // Row divider
    page.drawRectangle({ x: marginLeft, y: cursorY - 0.15, width: availableWidth, height: 0.3, color: rgb(0.90, 0.91, 0.93) });
    moveY(6);
  }

  // Totals
  moveY(8);
  const totalLabel = "TOTAL";
  const totalValue = formatCurrency(Number(total || 0));
  const totalSize = 12;
  page.drawText(totalLabel, { x: marginLeft, y: cursorY, size: totalSize, font: helveticaBold, color: rgb(0.066, 0.094, 0.153) });
  const totalValueW = helveticaBold.widthOfTextAtSize(totalValue, totalSize);
  page.drawText(totalValue, { x: width - marginRight - totalValueW, y: cursorY, size: totalSize, font: helveticaBold, color: rgb(0.066, 0.094, 0.153) });
  moveY(18);

  if (header?.observacoes) {
    const obs = String(header.observacoes || '');
    // simple wrap for obs
    const obsSize = 10;
    const maxWidth = width - marginLeft - marginRight;
    let start = 0;
    while (start < obs.length) {
      let end = obs.length;
      while (end > start) {
        const slice = obs.slice(start, end);
        if (helvetica.widthOfTextAtSize(slice, obsSize) <= maxWidth) break;
        end--;
      }
      const line = obs.slice(start, end);
      page.drawText(line, { x: marginLeft, y: cursorY, size: obsSize, font: helvetica, color: rgb(0.29, 0.33, 0.39) });
      moveY(obsSize + 4);
      start = end;
    }
    moveY(6);
  }

  // Footer
  const footerTxt = "Deus seja louvado";
  const footerSize = 11;
  const footerW = helveticaBold.widthOfTextAtSize(footerTxt, footerSize);
  page.drawText(footerTxt, { x: marginLeft + (availableWidth - footerW) / 2, y: cursorY, size: footerSize, font: helveticaBold, color: rgb(0.066, 0.094, 0.153) });

  const saveOpts = { useObjectStreams: false } as const;
  const pdfBytes = await pdfDoc.save(saveOpts);
  
  // Validate PDF header %PDF-
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

  // Native platforms: save to public storage as base64 without data URI prefix
  try {
    const status = await Filesystem.checkPermissions();
    const state = (status as any)?.publicStorage || (status as any)?.state;
    if (state && String(state).toLowerCase() !== 'granted') {
      await Filesystem.requestPermissions();
    }
  } catch {}

  // CORREÇÃO CRÍTICA: Usar conversão manual de bytes para base64 ao invés de saveAsBase64()
  // Isso garante encoding correto e compatibilidade com Android
  const base64Data = bytesToBase64(pdfBytes);
  
  // Validar que o base64 foi gerado corretamente
  if (!base64Data || base64Data.length === 0) {
    throw new Error('Falha ao converter PDF para base64');
  }
  
  console.log(`[PDF] PDF gerado com ${pdfBytes.length} bytes, base64 com ${base64Data.length} caracteres`);

  const writeAndCheckSize = async (directory: Directory, path: string): Promise<void> => {
    try {
      const writeResult = await Filesystem.writeFile({
        path,
        data: base64Data,
        directory,
        recursive: true,
      });
      console.log(`[PDF] WriteFile result:`, writeResult);
      
      const st = await Filesystem.stat({ path, directory });
      const size = Number((st as any)?.size ?? 0);
      console.log(`[PDF] Arquivo salvo em ${directory}/${path} com ${size} bytes`);
      
      if (!Number.isFinite(size) || size <= 0) {
        throw new Error('Arquivo salvo com tamanho zero');
      }
      
      // Verificação adicional: tentar ler o arquivo e validar
      const readResult = await Filesystem.readFile({ path, directory });
      const readData = String((readResult as any)?.data || '');
      if (!readData || readData.length === 0) {
        throw new Error('Arquivo salvo mas não pode ser lido');
      }
      
      console.log(`[PDF] Verificação: arquivo lido com sucesso (${readData.length} caracteres)`);
    } catch (err) {
      console.error(`[PDF] Erro ao salvar em ${directory}/${path}:`, err);
      throw err;
    }
  };

  let usedDirectoryName: 'Downloads' | 'Documents' = 'Downloads';
  // Try multiple public locations
  try {
    await writeAndCheckSize(Directory.Downloads as any, filename);
    usedDirectoryName = 'Downloads';
  } catch {
    try {
      // Many Android ROMs require ExternalStorage with explicit Download/ prefix
      await writeAndCheckSize(Directory.ExternalStorage as any, `Download/${filename}`);
      usedDirectoryName = 'Downloads';
    } catch {
      try {
        await writeAndCheckSize(Directory.Documents, filename);
        usedDirectoryName = 'Documents';
      } catch {
        // Last resort: app-specific external/data
        try {
          await writeAndCheckSize(Directory.External as any, filename);
          usedDirectoryName = 'Documents';
        } catch {
          await writeAndCheckSize(Directory.Data, filename);
          usedDirectoryName = 'Documents';
        }
      }
    }
  }

  return { filename, usedDirectoryName };
}


