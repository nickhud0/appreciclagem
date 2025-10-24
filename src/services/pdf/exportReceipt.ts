import html2canvas from "html2canvas";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;

type GeneratePdfParams = {
  receiptElement: HTMLElement;
  codigo: string;
};

function sanitizeFilename(input: string): string {
  const base = (input || "comanda").trim();
  const safe = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe || "comanda";
}

export async function generateAndSaveReceiptPdf({ receiptElement, codigo }: GeneratePdfParams): Promise<{ filename: string; savedPath: string | null }>{
  // Render receipt element to canvas with high DPI for sharpness
  const canvas = await html2canvas(receiptElement, { scale: 2, backgroundColor: "#FFFFFF" });
  const imgData = canvas.toDataURL("image/png", 1.0);

  // 58mm width page, dynamic height (mm). Add small margins (2mm)
  const mmToPt = (mm: number) => (mm * 72) / 25.4; // pdfmake uses points
  const paperWidthMm = 58;
  const marginMm = 2;
  const contentWidthMm = Math.max(1, paperWidthMm - marginMm * 2);
  const imgHeightMm = (canvas.height / canvas.width) * contentWidthMm;
  const pageHeightMm = Math.max(8, imgHeightMm + marginMm * 2);
  const paperWidthPt = mmToPt(paperWidthMm);
  const pageHeightPt = mmToPt(pageHeightMm);
  const marginPt = mmToPt(marginMm);
  const contentWidthPt = mmToPt(contentWidthMm);

  const docDefinition: any = {
    pageSize: { width: paperWidthPt, height: pageHeightPt },
    pageMargins: [marginPt, marginPt, marginPt, marginPt],
    content: [
      {
        image: imgData,
        width: contentWidthPt,
        alignment: 'left'
      }
    ]
  };

  const pdfBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
    (pdfMake as any).createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      try {
        resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      } catch (e) {
        reject(e);
      }
    });
  });

  // Convert ArrayBuffer → base64 robustly
  const base64Data = (() => {
    const bytes = new Uint8Array(pdfBuffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  })();

  const filename = `${sanitizeFilename(codigo)}.pdf`;

  // Permissions for public storage (Android)
  try {
    const status = await Filesystem.checkPermissions();
    const state = (status as any)?.publicStorage || (status as any)?.state;
    if (state && String(state).toLowerCase() !== "granted") {
      await Filesystem.requestPermissions();
    }
  } catch {}

  // Prefer Downloads, fallback to Documents, then Data
  const tryWrite = async (directory: Directory) => {
    await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory,
      recursive: true,
      encoding: 'base64' as any,
      mimeType: 'application/pdf' as any,
    });
    return Filesystem.getUri({ path: filename, directory });
  };

  let savedPath: string | null = null;
  try {
    const res = await tryWrite(Directory.Downloads);
    savedPath = res.uri || null;
  } catch {
    try {
      const res = await tryWrite(Directory.Documents);
      savedPath = res.uri || null;
    } catch {
      const res = await tryWrite(Directory.Data);
      savedPath = res.uri || null;
    }
  }

  return { filename, savedPath };
}


