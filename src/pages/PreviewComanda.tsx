import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { executeQuery } from "@/database";
import { formatCurrency, formatDateTime, formatNumber } from "@/utils/formatters";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ComandaHeader = {
  comanda_id: number | null;
  comanda_data: string | null;
  codigo: string | null;
  comanda_tipo: string | null;
  observacoes: string | null;
  comanda_total: number | null;
};

type ComandaItem = {
  item_id: number | null;
  material_id: number | null;
  material_nome: string | null;
  preco_kg: number | null;
  kg_total: number | null;
  item_valor_total: number | null;
};

const PreviewComanda = () => {
  const navigate = useNavigate();
  const [header, setHeader] = useState<ComandaHeader | null>(null);
  const [itens, setItens] = useState<ComandaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadLatestComanda() {
      try {
        setLoading(true);
        const heads = await executeQuery<ComandaHeader>(
          `SELECT comanda_id, comanda_data, codigo, comanda_tipo, observacoes, comanda_total
           FROM comanda_20
           WHERE comanda_id IS NOT NULL
           ORDER BY comanda_data DESC
           LIMIT 1`
        );

        const h = heads?.[0] || null;
        setHeader(h);

        if (h?.comanda_id != null) {
          const lines = await executeQuery<ComandaItem>(
            `SELECT c.item_id, c.material_id, m.nome as material_nome, c.preco_kg, c.kg_total, c.item_valor_total
             FROM comanda_20 c
             LEFT JOIN material m ON m.id = c.material_id
             WHERE c.comanda_id = ?
             ORDER BY c.item_id ASC`,
            [h.comanda_id]
          );
          setItens(lines || []);
        } else {
          setItens([]);
        }
      } finally {
        setLoading(false);
      }
    }
    const nav = window.history.state && (window.history.state as any).usr;
    const fromState = nav && (nav as any).comandaSelecionada;
    if (fromState && typeof fromState === 'object') {
      setHeader({
        comanda_id: Number((fromState as any).comanda_id) || null,
        comanda_data: (fromState as any).comanda_data || null,
        codigo: (fromState as any).codigo || null,
        comanda_tipo: (fromState as any).comanda_tipo || null,
        observacoes: (fromState as any).observacoes || null,
        comanda_total: Number((fromState as any).comanda_total) || null,
      });
      try {
        const items = Array.isArray((fromState as any).items) ? (fromState as any).items : [];
        setItens(items.map((it: any, idx: number) => ({
          item_id: idx + 1,
          material_id: Number(it.material_id) || null,
          material_nome: it.material_nome ?? null,
          preco_kg: Number(it.preco_kg) || 0,
          kg_total: Number(it.kg_total) || 0,
          item_valor_total: Number(it.item_valor_total ?? ((Number(it.kg_total)||0) * (Number(it.preco_kg)||0))) || 0,
        })));
      } catch {
        setItens([]);
      }
      setLoading(false);
      return;
    }
    void loadLatestComanda();
  }, []);

  const totalCalculado = useMemo(() => {
    if (header?.comanda_total != null) return header.comanda_total;
    return itens.reduce((acc, it) => acc + (Number(it.item_valor_total) || 0), 0);
  }, [header, itens]);

  const groupedItens = useMemo(() => {
    const map = new Map<string, { nome: string; kg: number; total: number }>();
    for (const it of itens) {
      const key = (it.material_id != null && !Number.isNaN(Number(it.material_id)))
        ? String(it.material_id)
        : (it.material_nome || '—');
      const nome = it.material_nome || `#${it.material_id ?? ''}`;
      const kg = Number(it.kg_total || 0) || 0;
      const preco = Number(it.preco_kg || 0) || 0;
      const subtotal = Number(it.item_valor_total || (kg * preco)) || 0;
      const prev = map.get(key) || { nome, kg: 0, total: 0 };
      prev.nome = nome;
      prev.kg += kg;
      prev.total += subtotal;
      map.set(key, prev);
    }
    return Array.from(map.values()).map((g) => ({
      nome: g.nome,
      kg: g.kg,
      total: g.total,
      precoMedio: g.kg > 0 ? Number((g.total / g.kg).toFixed(2)) : 0
    }));
  }, [itens]);

  // Escala automática baseada na largura da tela (sem rolagem horizontal)
  const computeScale = useCallback(() => {
    try {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const horizontalPadding = 24; // aproximadamente px-4
      const baseWidth = 340; // largura fixa da comanda
      const sW = Math.max(0, (vw - horizontalPadding)) / baseWidth;
      let s = Math.min(1.35, Math.max(1.0, sW));
      setScale(Number((isFinite(s) ? s : 1.0).toFixed(2)));
    } catch {}
  }, []);

  useEffect(() => {
    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [computeScale]);

  // Recalcular após carregamento/alteração dos itens para eliminar rolagem quando há espaço
  useEffect(() => {
    const id = window.requestAnimationFrame(() => computeScale());
    return () => window.cancelAnimationFrame(id);
  }, [computeScale, loading, itens.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!header) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Pré-visualização da Comanda</h1>
          </div>
        </div>
        <Card className="p-8 text-center rounded-xl border border-border/20 shadow-md">
          <h3 className="text-lg font-semibold mb-2">Nenhuma comanda encontrada</h3>
          <p className="text-muted-foreground">Registre uma comanda para visualizar aqui.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start w-full min-h-screen bg-background overflow-x-hidden overflow-y-auto pb-28">
      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Pré-visualização da Comanda</h1>
        </div>
      </div>

      {/* Cupom térmico 58mm fiel (largura fixa ~240px) com escala automática */}
      <div className="w-full flex justify-center items-start px-4 overflow-x-hidden">
        <div
          id="comanda-preview"
          className="bg-white text-black rounded-lg shadow-md mt-4 mb-8"
          style={{
            width: '340px',
            fontFamily: '\u0027Roboto Mono\u0027, monospace',
            fontSize: '16px',
            lineHeight: '1.4',
            overflowY: 'auto',
            overflowX: 'hidden',
            maxHeight: '82vh',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            paddingLeft: '10px',
            paddingRight: '10px',
          }}
        >
          <div ref={receiptRef} className="w-auto mx-auto px-3 sm:px-4 overflow-hidden break-words bg-white text-gray-900 p-3 rounded-lg shadow-md font-mono tracking-tight leading-tight">
          {/* Cabeçalho do cupom */}
          <div className="text-center text-lg font-bold">Reciclagem Perequê</div>
          <div className="text-center text-xs leading-tight my-1">
            <div>Ubatuba, Perequê Mirim</div>
            <div>Av. Marginal, 2504</div>
            <div>12 99162-0321</div>
            <div>CNPJ/PIX 45.492.161/0001-88</div>
          </div>
          <div className="border-b border-gray-400 my-2" />
          <div className="text-center text-sm">
            <div className="font-bold text-base">{header.codigo || '—'}</div>
            <div className="text-sm">{header.comanda_data ? formatDateTime(header.comanda_data) : '—'}</div>
            <div className="uppercase font-bold text-sm">{header.comanda_tipo || '—'}</div>
          </div>

          <div className="border-b border-gray-400 my-2" />

          {/* Itens */}
          {groupedItens.length === 0 ? (
            <div className="text-center text-[13px]">Nenhum item</div>
          ) : (
            <div>
              {/* Cabeçalho de colunas */}
              <div className="grid grid-cols-[40%_15%_22%_23%] gap-0.5 text-xs md:text-sm font-semibold text-gray-700">
                <div>Material</div>
                <div className="text-right whitespace-nowrap">Kg</div>
                <div className="text-right whitespace-nowrap">Preço</div>
                <div className="text-right whitespace-nowrap">Total</div>
              </div>
              <div className="border-b border-dotted border-gray-300 my-1" />
              {/* Linhas de itens (uma linha por material) */}
              {groupedItens.map((g, idx) => (
                <div key={idx} className="grid grid-cols-[40%_15%_22%_23%] gap-0.5 items-center text-sm md:text-base py-2">
                  <div className="pr-0.5 break-words whitespace-normal leading-normal">{g.nome}</div>
                  <div className="text-right tabular-nums whitespace-nowrap">{formatNumber(g.kg, 2)}</div>
                  <div className="text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(g.precoMedio)}</div>
                  <div className="text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(g.total)}</div>
                  <div className="col-span-4 border-b border-dotted border-gray-300 my-1" />
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-400 my-2" />

          {/* Totais */}
          <div className="text-center text-base md:text-lg font-semibold text-black">
            TOTAL: {formatCurrency(Number(totalCalculado) || 0)}
          </div>
          {header.observacoes ? (
            <div className="text-center mt-1 text-xs md:text-sm text-gray-600 italic whitespace-pre-wrap">
              {header.observacoes}
            </div>
          ) : null}

          <div className="border-t border-gray-400 my-2" />

          {/* Rodapé do cupom */}
          <div className="text-base font-semibold text-center mt-4 pb-6">Deus seja louvado</div>
          </div>
        </div>
      </div>

      {/* === BOTÕES FLUTUANTES FIXOS === */}
      <div className="fixed bottom-4 left-0 w-full flex justify-center z-50">
        <div ref={actionsRef} className="flex justify-center gap-3 w-[95%] max-w-sm bg-background/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-border/30">
          <button
            className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold text-base shadow-sm active:scale-95"
            onClick={() => setIsWhatsAppModalOpen(true)}
          >
            WhatsApp
          </button>
          <button className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-semibold text-base shadow-sm active:scale-95" onClick={async () => {
            try {
              const node = receiptRef.current;
              if (!node) throw new Error("Pré-visualização da comanda não encontrada");

              // Capturar conteúdo com nitidez
              const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#FFFFFF" });
              const imgData = canvas.toDataURL("image/png", 1.0);

              // PDF térmico 58mm, com 2mm de margem, altura proporcional
              const paperWidthMm = 58;
              const marginMm = 2;
              const contentWidthMm = Math.max(1, paperWidthMm - marginMm * 2);
              const imgHeightMm = (canvas.height / canvas.width) * contentWidthMm;
              const pageHeightMm = Math.max(1, imgHeightMm + marginMm * 2);

              const pdf = new jsPDF({ unit: "mm", format: [paperWidthMm, pageHeightMm], orientation: "portrait" });
              pdf.addImage(imgData, "PNG", marginMm, marginMm, contentWidthMm, imgHeightMm);

              // Converter para base64 via Blob + FileReader (mais confiável no Android)
              const blob = pdf.output("blob");
              const base64Data: string = await new Promise((resolve, reject) => {
                try {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    try {
                      const result = String(reader.result || "");
                      const idx = result.indexOf(",");
                      resolve(idx >= 0 ? result.slice(idx + 1) : result);
                    } catch (e) { reject(e); }
                  };
                  reader.onerror = (e) => reject(e);
                  reader.readAsDataURL(blob);
                } catch (e) {
                  reject(e);
                }
              });

              // Nome do arquivo
              const codigoRaw = (header?.codigo && String(header.codigo).trim()) || "comanda";
              const codigo = codigoRaw.replace(/[^A-Za-z0-9._-]/g, "_");
              const filename = `${codigo}.pdf`;

              // Permissões (Android) — solicitar se necessário
              try {
                const status = await Filesystem.checkPermissions();
                const state = (status as any)?.publicStorage || (status as any)?.state;
                if (state && String(state).toLowerCase() !== "granted") {
                  await Filesystem.requestPermissions();
                }
              } catch {}

              // Salvar automaticamente em Downloads; fallback para Documents
              let saved = false;
              try {
                await Filesystem.writeFile({
                  path: filename,
                  data: base64Data,
                  directory: Directory.Downloads,
                  recursive: true,
                  encoding: 'base64' as any,
                  mimeType: 'application/pdf' as any,
                });
                saved = true;
              } catch {
                try {
                  await Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
                    directory: Directory.Documents,
                    recursive: true,
                    encoding: 'base64' as any,
                    mimeType: 'application/pdf' as any,
                  });
                  saved = true;
                } catch (err2) {
                  throw err2;
                }
              }

              if (saved) {
                toast({ description: "PDF salvo com sucesso" as any });
              }
            } catch (err) {
              toast({ description: "Falha ao salvar o PDF. Tente novamente.", variant: "destructive" as any });
            }
          }}>
            PDF
          </button>
          <button className="flex-1 py-3 rounded-lg bg-gray-700 text-white font-semibold text-base shadow-sm active:scale-95">
            Imprimir
          </button>
        </div>
      </div>
      

      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar pelo WhatsApp</DialogTitle>
            <DialogDescription>
              Informe o número do cliente com DDD. O código do país (+55) já está incluído automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="wa-number" className="sr-only">Número</Label>
            <Input
              id="wa-number"
              type="tel"
              placeholder="ex: 12933482617"
              className="text-base"
              value={whatsAppNumber}
              onChange={(e) => setWhatsAppNumber(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" onClick={() => setIsWhatsAppModalOpen(false)} disabled={isLoading}>Cancelar</Button>
            </DialogClose>
            <Button className="bg-green-600 hover:bg-green-600/90" onClick={async () => {
              const sanitizePhoneNumber = (input: string) => {
                try {
                  const digits = String(input || "").replace(/\D+/g, "");
                  const trimmed = digits.startsWith("55") ? digits.slice(2) : digits;
                  return trimmed;
                } catch { return ""; }
              };
              const isValidPhoneNumber = (digits: string) => digits.length === 10 || digits.length === 11;

              try {
                const sanitized = sanitizePhoneNumber(whatsAppNumber);
                if (!isValidPhoneNumber(sanitized)) {
                  toast({ description: "Número inválido. Informe DDD + número (10–11 dígitos).", variant: "destructive" as any });
                  return;
                }
                setIsLoading(true);

                const isWeb = Capacitor.getPlatform() === "web";
                const codigo = (header?.codigo || "comanda").toString();
                const waUrl = `https://wa.me/+55${sanitized}`;

                if (isWeb) {
                  await Browser.open({ url: waUrl });
                  setIsWhatsAppModalOpen(false);
                  return;
                }

                const node = receiptRef.current;
                if (!node) throw new Error("Pré-visualização da comanda não encontrada");

                const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
                const imgData = canvas.toDataURL("image/png", 1.0);

                const paperWidthMm = 58;
                const marginMm = 2;
                const contentWidthMm = Math.max(1, paperWidthMm - marginMm * 2);
                const imgHeightMm = (canvas.height / canvas.width) * contentWidthMm;
                const pageHeightMm = Math.max(1, imgHeightMm + marginMm * 2);

                const pdf = new jsPDF({ unit: "mm", format: [paperWidthMm, pageHeightMm], orientation: "portrait" });
                pdf.addImage(imgData, "PNG", marginMm, marginMm, contentWidthMm, imgHeightMm);

                const blob = pdf.output("blob");
                const arrayBuffer = await blob.arrayBuffer();
                const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

                const filename = `${codigo}-${sanitized}.pdf`;
                await Filesystem.writeFile({
                  path: filename,
                  data: base64Data,
                  directory: Directory.Downloads,
                  recursive: true,
                });

                await Browser.open({ url: waUrl });
                setIsWhatsAppModalOpen(false);
              } catch (err) {
                toast({ description: "Falha ao preparar ou abrir o WhatsApp. Verifique o número e tente novamente.", variant: "destructive" as any });
              } finally {
                setIsLoading(false);
              }
            }} disabled={isLoading}>
              {isLoading ? "Preparando..." : "Abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreviewComanda;


