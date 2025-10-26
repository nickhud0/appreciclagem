import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { formatCurrency, formatNumber, formatDateTime, formatDate } from "@/utils/formatters";

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

// Função para formatar apenas o horário
function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(dateObj);
}

export async function generateAndSaveComandaA4Pdf({ header, groupedItens, total }: GenerateParams): Promise<{ filename: string; usedDirectoryName: 'Downloads' | 'Documents' }>{
  const codigo = String(header?.codigo || "comanda");
  const filename = `comanda-${sanitizeFilename(codigo)}.pdf`;

  // Layout otimizado - formato A4 com comanda ocupando mais espaço
  const pdfDoc = await PDFDocument.create();
  const paperWidthMm = 210; // A4 width
  const paperHeightMm = 297; // A4 height
  const marginMm = 15; // Margem reduzida
  const paperWidthPt = mmToPt(paperWidthMm);
  const paperHeightPt = mmToPt(paperHeightMm);
  const marginPt = mmToPt(marginMm);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Typography configuration com tamanhos muito maiores para melhor visibilidade
  const fonts = {
    title: { size: 32, font: helveticaBold, lh: 38 }, // text-lg muito maior
    sub: { size: 22, font: helvetica, lh: 28 }, // text-sm muito maior
    meta: { size: 22, font: helvetica, lh: 28 }, // text-sm muito maior
    itemName: { size: 22, font: helvetica, lh: 28 }, // text-sm muito maior
    itemDetail: { size: 22, font: helvetica, lh: 28 }, // text-sm muito maior
    total: { size: 28, font: helveticaBold, lh: 34 }, // text-base muito maior
    footer: { size: 20, font: helvetica, lh: 26 }, // text-xs muito maior
    footerBold: { size: 20, font: helveticaBold, lh: 26 }, // text-xs font-bold muito maior
  };

  // Spacing configuration otimizado para fontes maiores
  const spacing = {
    xs: 10, // space-y-1 muito maior
    sm: 16, // space-y-2 muito maior
    md: 24, // mb-4 muito maior
    lg: 36, // my-4 muito maior
  };

  const availableWidth = paperWidthPt - marginPt * 2;
  const maxCardWidth = mmToPt(600); // Largura muito aumentada para ocupar máximo espaço
  const cardWidth = Math.min(availableWidth, maxCardWidth);
  const cardX = marginPt + (availableWidth - cardWidth) / 2;

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

  // Calculate total page height needed (otimizado para reduzir espaços em branco)
  const calculateHeight = (): number => {
    let h = marginPt; // top margin
    
    // Cabeçalho (centralizado)
    h += fonts.title.lh + spacing.md; // Nome da empresa
    h += fonts.sub.lh + spacing.xs; // Endereço linha 1
    h += fonts.sub.lh + spacing.xs; // Endereço linha 2  
    h += fonts.sub.lh + spacing.xs; // Telefone
    h += fonts.sub.lh + spacing.md; // CNPJ/PIX
    
    // Separador
    h += spacing.lg; // my-4
    
    // Dados da Comanda (4 linhas)
    h += fonts.meta.lh + spacing.xs; // Comanda
    h += fonts.meta.lh + spacing.xs; // Data
    h += fonts.meta.lh + spacing.xs; // Horário
    h += fonts.meta.lh + spacing.md; // Tipo
    
    // Separador
    h += spacing.lg; // my-4
    
    // Itens (2 linhas por item)
    for (const _ of groupedItens) {
      h += fonts.itemName.lh + spacing.xs; // Nome do produto
      h += fonts.itemDetail.lh + spacing.sm; // Quantidade x preço + total
    }
    
    // Separador
    h += spacing.lg; // my-4
    
    // Total
    h += fonts.total.lh + spacing.md;
    
    // Separador
    h += spacing.lg; // my-4
    
    // Rodapé (3 linhas)
    h += fonts.footer.lh + spacing.xs; // Obrigado
    h += fonts.footerBold.lh + spacing.sm; // DEUS SEJA LOUVADO!!!
    h += fonts.footer.lh + spacing.md; // Versao 1.0
    
    h += marginPt; // bottom margin
    
    // Ajustar altura mínima para fontes maiores
    return Math.max(h, mmToPt(200)); // Altura mínima ajustada para fontes maiores
  };

  const pageHeight = calculateHeight();
  const page = pdfDoc.addPage([paperWidthPt, pageHeight]);
  const pageW = page.getSize().width;
  const pageH = page.getSize().height;

  let y = pageH - marginPt;

  // Helper: draw text at cursor position (centralizado no card)
  const draw = (text: string, style: any, align: 'left' | 'center' | 'right' = 'left') => {
    const { size, font } = style;
    const textW = font.widthOfTextAtSize(text, size);
    let x = cardX;
    
    if (align === 'center') {
      x = cardX + (cardWidth - textW) / 2;
    } else if (align === 'right') {
      x = cardX + cardWidth - textW;
    }
    
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) }); // Preto como na pré-visualização
  };

  const move = (amount: number) => { y -= amount; };

  // Helper: draw separator line (tracejada)
  const drawSeparator = () => {
    const dashLength = 3;
    const gapLength = 2;
    let x = cardX;
    
    while (x < cardX + cardWidth) {
      const dashEnd = Math.min(x + dashLength, cardX + cardWidth);
      page.drawLine({
        start: { x, y: y - 1 },
        end: { x: dashEnd, y: y - 1 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
      });
      x = dashEnd + gapLength;
    }
  };

  // === RENDER CONTENT (replicando exatamente o layout da pré-visualização) ===

  // Cabeçalho (centralizado)
  draw("Reciclagem Pereque", fonts.title, 'center');
  move(fonts.title.lh + spacing.md);
  
  draw("Ubatuba, Pereque Mirim, Av Marginal, 2504", fonts.sub, 'center');
  move(fonts.sub.lh + spacing.xs);
  
  draw("12 99162-0321", fonts.sub, 'center');
  move(fonts.sub.lh + spacing.xs);
  
  draw("CNPJ/PIX - 45.492.161/0001-88", fonts.sub, 'center');
  move(fonts.sub.lh + spacing.md);

  // Separador tracejado
  drawSeparator();
  move(spacing.lg);

  // Dados da Comanda
  const comandaLabel = "Comanda:";
  const comandaValue = header?.codigo || '—';
  const comandaLabelW = fonts.meta.font.widthOfTextAtSize(comandaLabel, fonts.meta.size);
  page.drawText(comandaLabel, { x: cardX, y, size: fonts.meta.size, font: fonts.meta.font, color: rgb(0, 0, 0) });
  page.drawText(comandaValue, { x: cardX + cardWidth - fonts.meta.font.widthOfTextAtSize(comandaValue, fonts.meta.size), y, size: fonts.meta.size, font: helveticaBold, color: rgb(0, 0, 0) });
  move(fonts.meta.lh + spacing.xs);

  const dataLabel = "Data:";
  const dataValue = header?.comanda_data ? formatDate(header.comanda_data) : '—';
  page.drawText(dataLabel, { x: cardX, y, size: fonts.meta.size, font: fonts.meta.font, color: rgb(0, 0, 0) });
  page.drawText(dataValue, { x: cardX + cardWidth - fonts.meta.font.widthOfTextAtSize(dataValue, fonts.meta.size), y, size: fonts.meta.size, font: fonts.meta.font, color: rgb(0, 0, 0) });
  move(fonts.meta.lh + spacing.xs);

  const horarioLabel = "Horário:";
  const horarioValue = header?.comanda_data ? formatTime(header.comanda_data) : '—';
  page.drawText(horarioLabel, { x: cardX, y, size: fonts.meta.size, font: fonts.meta.font, color: rgb(0, 0, 0) });
  page.drawText(horarioValue, { x: cardX + cardWidth - fonts.meta.font.widthOfTextAtSize(horarioValue, fonts.meta.size), y, size: fonts.meta.size, font: fonts.meta.font, color: rgb(0, 0, 0) });
  move(fonts.meta.lh + spacing.xs);

  const tipoLabel = "Tipo:";
  const tipoValue = (header?.comanda_tipo || '—').toUpperCase();
  page.drawText(tipoLabel, { x: cardX, y, size: fonts.meta.size, font: fonts.meta.font, color: rgb(0, 0, 0) });
  page.drawText(tipoValue, { x: cardX + cardWidth - fonts.meta.font.widthOfTextAtSize(tipoValue, fonts.meta.size), y, size: fonts.meta.size, font: fonts.meta.font, color: rgb(0, 0, 0) });
  move(fonts.meta.lh + spacing.md);

  // Separador tracejado
  drawSeparator();
  move(spacing.lg);

  // Itens
  if (groupedItens.length === 0) {
    draw("Nenhum item", fonts.itemName, 'center');
    move(fonts.itemName.lh + spacing.md);
  } else {
    for (const item of groupedItens) {
      // Nome do produto (linha inteira)
      draw(item.nome, fonts.itemName, 'left');
      move(fonts.itemName.lh + spacing.xs);
      
      // Quantidade x preço (indentado) | total (direita)
      const detailText = `${formatNumber(item.kg, 2)}x R$ ${item.precoMedio.toFixed(2)}`;
      const totalText = `R$ ${item.total.toFixed(2)}`;
      const indentX = cardX + mmToPt(20); // Indentação muito maior para fontes maiores
      
      page.drawText(detailText, { x: indentX, y, size: fonts.itemDetail.size, font: fonts.itemDetail.font, color: rgb(0, 0, 0) });
      page.drawText(totalText, { x: cardX + cardWidth - fonts.itemDetail.font.widthOfTextAtSize(totalText, fonts.itemDetail.size), y, size: fonts.itemDetail.size, font: helveticaBold, color: rgb(0, 0, 0) });
      move(fonts.itemDetail.lh + spacing.sm);
    }
  }

  // Separador tracejado
  drawSeparator();
  move(spacing.lg);

  // Total
  const totalLabel = "TOTAL:";
  const totalValue = `R$ ${Number(total).toFixed(2)}`;
  page.drawText(totalLabel, { x: cardX, y, size: fonts.total.size, font: fonts.total.font, color: rgb(0, 0, 0) });
  page.drawText(totalValue, { x: cardX + cardWidth - fonts.total.font.widthOfTextAtSize(totalValue, fonts.total.size), y, size: fonts.total.size, font: fonts.total.font, color: rgb(0, 0, 0) });
  move(fonts.total.lh + spacing.md);

  // Separador tracejado
  drawSeparator();
  move(spacing.lg);

  // Rodapé (centralizado)
  draw("Obrigado", fonts.footer, 'center');
  move(fonts.footer.lh + spacing.xs);
  
  draw("DEUS SEJA LOUVADO!!!", fonts.footerBold, 'center');
  move(fonts.footerBold.lh + spacing.sm);
  
  draw("Versao 1.0", fonts.footer, 'center');

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
