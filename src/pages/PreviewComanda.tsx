import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { executeQuery } from "@/database";
import { formatCurrency, formatDateTime, formatNumber, formatDate } from "@/utils/formatters";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateAndSaveComandaA4Pdf } from "@/services/pdf/generateComandaA4";

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

  // Função para formatar apenas o horário
  const formatTime = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(dateObj);
  };

  useEffect(() => {
    async function loadLatestComanda() {
      try {
        setLoading(true);
        
        // Buscar última comanda usando a mesma lógica do Histórico de Comandas
        // para incluir comandas pendentes (sync_queue) e confirmadas
        
        // 1. Buscar comandas confirmadas (já sincronizadas)
        const confirmed = await executeQuery<ComandaHeader>(
          `SELECT comanda_id, comanda_data, codigo, comanda_tipo, observacoes, comanda_total
           FROM comanda_20
           WHERE comanda_id IS NOT NULL
           ORDER BY comanda_data DESC`
        );

        // 2. Buscar comandas pendentes da sync_queue
        const pendingComandaInserts = await executeQuery<any>(
          `SELECT payload, created_at, record_id, id
           FROM sync_queue
           WHERE synced = 0 AND table_name = 'comanda' AND operation = 'INSERT'
           ORDER BY created_at DESC`
        );

        const pendingItemInserts = await executeQuery<any>(
          `SELECT payload, created_at, id
           FROM sync_queue
           WHERE synced = 0 AND table_name = 'item' AND operation = 'INSERT'
           ORDER BY created_at ASC`
        );

        const pendingUltimasInserts = await executeQuery<any>(
          `SELECT payload, created_at, id
           FROM sync_queue
           WHERE synced = 0 AND table_name = 'ultimas_20' AND operation = 'INSERT'
           ORDER BY created_at ASC`
        );

        // Função para extrair chave da comanda do payload
        const getPendingComandaKey = (payload: any, fallback?: string | number | null): string | null => {
          try {
            if (payload && typeof payload === 'object') {
              const candidates = [
                payload.codigo,
                payload.comanda_codigo,
                payload.comanda_id,
                payload.comanda,
                payload.id_local,
                payload.local_id,
                payload.temp_id
              ];
              for (const c of candidates) {
                if (c !== undefined && c !== null && String(c).trim() !== '') return String(c);
              }
            }
          } catch {}
          return fallback != null ? String(fallback) : null;
        };

        const safeParse = (s: string) => {
          try { return JSON.parse(s || '{}'); } catch { return {}; }
        };

        // Agrupar itens pendentes por chave da comanda
        const itemsByKey: Record<string, any[]> = {};
        for (const it of pendingItemInserts) {
          const payload = safeParse(it.payload);
          const key = getPendingComandaKey(payload, null);
          if (key == null) continue;
          if (!itemsByKey[key]) itemsByKey[key] = [];
          itemsByKey[key].push({ ...payload, __queueCreatedAt: it.created_at, __syncId: it.id, __table: 'item', __source: 'sync_queue' });
        }

        // Também incluir itens de 'ultimas_20'
        for (const row of pendingUltimasInserts) {
          const payload = safeParse(row.payload);
          const key = getPendingComandaKey(payload, payload.comanda ?? payload.comanda_id ?? null);
          if (key == null) continue;
          if (!itemsByKey[key]) itemsByKey[key] = [];
          const precoKg = payload.preco_kg ?? payload.preco ?? 0;
          const kg = payload.kg_total ?? payload.quantidade ?? payload.kg ?? 0;
          const itemTotal = (payload.valor_total ?? payload.total ?? (Number(precoKg) * Number(kg))) || 0;
          itemsByKey[key].push({
            material_id: payload.material ?? null,
            preco_kg: precoKg,
            kg_total: kg,
            item_valor_total: itemTotal,
            __source: 'sync_queue',
            __syncId: row.id,
            __table: 'ultimas_20',
            __queueCreatedAt: row.created_at
          });
        }

        // Construir mapa de comandas pendentes
        const pendingComandasMap: Record<string, any> = {};
        for (const row of pendingComandaInserts) {
          const payload = safeParse(row.payload);
          const localFallback = row.record_id ?? payload.id ?? payload.local_id ?? payload.temp_id ?? row.id;
          const key = getPendingComandaKey(payload, localFallback);
          if (key == null) continue;
          if (!pendingComandasMap[key]) {
            pendingComandasMap[key] = {
              comanda_key: key,
              comanda_id: String(localFallback),
              codigo: payload.codigo ?? payload.code ?? null,
              comanda_data: payload.data ?? payload.comanda_data ?? row.created_at ?? null,
              comanda_tipo: payload.tipo ?? payload.comanda_tipo ?? null,
              observacoes: payload.observacoes ?? null,
              origem_offline: 1,
              __is_pending: true,
              items: [] as any[]
            };
          }
        }

        // Anexar itens às comandas pendentes
        for (const key of Object.keys(itemsByKey)) {
          const list = itemsByKey[key] || [];
          if (!pendingComandasMap[key]) {
            pendingComandasMap[key] = {
              comanda_key: key,
              comanda_id: key,
              codigo: null,
              comanda_data: null,
              comanda_tipo: null,
              observacoes: null,
              origem_offline: 1,
              __is_pending: true,
              items: [] as any[]
            };
          }
          pendingComandasMap[key].items.push(...list.map((it: any) => ({
            material_id: it.material ?? it.material_id ?? it.materialId ?? null,
            kg_total: it.kg_total ?? it.quantidade ?? it.kg ?? 0,
            preco_kg: it.preco_kg ?? it.preco ?? 0,
            item_valor_total: (it.valor_total ?? it.total ?? ((Number(it.preco_kg ?? it.preco) || 0) * (Number(it.kg_total ?? it.quantidade ?? it.kg) || 0))) || 0,
            __source: it.__source ?? 'sync_queue',
            __syncId: it.__syncId ?? null,
            __table: it.__table ?? null
          })));
        }

        // Agrupar comandas confirmadas
        const confirmedGroupsMap: Record<string, any> = {};
        for (const r of confirmed) {
          const key = String(r.comanda_id ?? r.codigo ?? `c-${r.item_id ?? Math.random()}`);
          if (!confirmedGroupsMap[key]) {
            confirmedGroupsMap[key] = {
              comanda_id: r.comanda_id ?? key,
              codigo: r.codigo ?? null,
              comanda_data: r.comanda_data ?? null,
              comanda_tipo: r.comanda_tipo ?? null,
              observacoes: r.observacoes ?? null,
              origem_offline: r.origem_offline ?? 0,
              __is_pending: false,
              items: [] as any[]
            };
          }
          // Só adicionar item se tiver dados válidos (kg > 0 ou valor > 0)
          const kg = Number(r.kg_total) || 0;
          const valor = Number(r.item_valor_total) || 0;
          if (kg > 0 || valor > 0) {
            confirmedGroupsMap[key].items.push({
              item_id: r.item_id ?? null,
              material_id: r.material_id ?? null,
              kg_total: kg,
              preco_kg: Number(r.preco_kg) || 0,
              item_valor_total: valor,
              __source: 'confirmed'
            });
          }
        }

        const confirmedGroups = Object.values(confirmedGroupsMap).map((g: any) => ({
          ...g,
          comanda_total: g.items.reduce((acc: number, it: any) => acc + (Number(it.item_valor_total) || 0), 0)
        }));

        // Para comandas confirmadas sem itens, tentar buscar itens separadamente
        for (const group of confirmedGroups) {
          if (group.items.length === 0 && group.comanda_id) {
            try {
              // Buscar itens diretamente da tabela 'item' se existir
              const itemRows = await executeQuery<any>(
                `SELECT i.*, m.nome as material_nome 
                 FROM item i 
                 LEFT JOIN material m ON m.id = i.material_id 
                 WHERE i.comanda_id = ?`,
                [group.comanda_id]
              );
              
              if (itemRows && itemRows.length > 0) {
                group.items = itemRows.map((item: any) => ({
                  item_id: item.id ?? null,
                  material_id: item.material_id ?? null,
                  material_nome: item.material_nome ?? null,
                  kg_total: Number(item.kg_total) || 0,
                  preco_kg: Number(item.preco_kg) || 0,
                  item_valor_total: Number(item.valor_total) || 0,
                  __source: 'confirmed_item_table'
                }));
                group.comanda_total = group.items.reduce((acc: number, it: any) => acc + (Number(it.item_valor_total) || 0), 0);
              }
            } catch (error) {
              // Ignorar erro se tabela item não existir
            }
          }
        }

        // Construir grupos pendentes com totais
        const pendingGroups = Object.values(pendingComandasMap)
          .map((g: any) => ({
            ...g,
            items: (Array.isArray(g.items) ? g.items : []).filter((it: any) => {
              const kg = Number(it.kg_total) || 0;
              const vt = Number(it.item_valor_total) || 0;
              return !(kg === 0 && vt === 0);
            }),
            comanda_total: (Array.isArray(g.items) ? g.items : []).reduce((acc: number, it: any) => acc + (Number(it.item_valor_total) || 0), 0)
          }))
          .filter((g: any) => Array.isArray(g.items) && g.items.length > 0);

        // Deduplicar por codigo, preferir confirmadas
        const confirmedCodes = new Set(
          confirmedGroups.map((c: any) => c.codigo).filter((x: any) => x != null)
        );
        const confirmedIds = new Set(
          confirmedGroups.map((c: any) => String(c.comanda_id || '')).filter((x: any) => x)
        );
        const pendingFiltered = pendingGroups.filter((r: any) => {
          const hasCode = !!r.codigo;
          if (hasCode && confirmedCodes.has(r.codigo)) return false;
          const rid = String(r.comanda_id || r.comanda_key || '');
          if (rid && confirmedIds.has(rid)) return false;
          return true;
        });

        // Unificar e ordenar por data (mais recente primeiro)
        const unifiedGroups = [...confirmedGroups, ...pendingFiltered].sort((a: any, b: any) => {
          const da = a.comanda_data ? new Date(a.comanda_data).getTime() : 0;
          const db = b.comanda_data ? new Date(b.comanda_data).getTime() : 0;
          return db - da;
        });

        // Pegar a primeira (mais recente)
        const latestComanda = unifiedGroups[0];
        
        if (latestComanda) {
          setHeader({
            comanda_id: Number(latestComanda.comanda_id) || null,
            comanda_data: latestComanda.comanda_data || null,
            codigo: latestComanda.codigo || null,
            comanda_tipo: latestComanda.comanda_tipo || null,
            observacoes: latestComanda.observacoes || null,
            comanda_total: Number(latestComanda.comanda_total) || null,
          });

          // Buscar nomes dos materiais para os itens
          const materialIds = Array.from(new Set(
            latestComanda.items.map((it: any) => Number(it.material_id)).filter((v: any) => Number.isFinite(v))
          ));
          
          let materialMap: Record<number, any> = {};
          if (materialIds.length > 0) {
            const placeholders = materialIds.map(() => '?').join(', ');
            const materials = await executeQuery<any>(`SELECT id, nome FROM material WHERE id IN (${placeholders})`, materialIds);
            materialMap = Object.fromEntries(materials.map((m: any) => [Number(m.id), m]));
          }

          setItens(latestComanda.items.map((it: any, idx: number) => ({
            item_id: idx + 1,
            material_id: Number(it.material_id) || null,
            material_nome: materialMap[Number(it.material_id)]?.nome ?? it.material_nome ?? null,
            preco_kg: Number(it.preco_kg) || 0,
            kg_total: Number(it.kg_total) || 0,
            item_valor_total: Number(it.item_valor_total) || 0,
          })));
        } else {
          setHeader(null);
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
      const nome = it.material_nome || `Material #${it.material_id ?? ''}`;
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

      {/* Comanda com novo layout */}
      <Card 
        ref={receiptRef}
        className="mb-6 p-6 bg-white text-black max-w-sm mx-auto" 
        style={{ fontFamily: 'monospace' }}
        data-scale={scale}
      >
        {/* Cabeçalho */}
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold">Reciclagem Pereque</h2>
          <p className="text-sm">Ubatuba, Pereque Mirim, Av Marginal, 2504</p>
          <p className="text-sm">12 99162-0321</p>
          <p className="text-sm">CNPJ/PIX - 45.492.161/0001-88</p>
        </div>

        <Separator className="my-4 border-dashed border-black" />

        {/* Dados da Comanda */}
        <div className="space-y-1 text-sm mb-4">
          <div className="flex justify-between">
            <span>Comanda:</span>
            <span className="font-bold">{header.codigo || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Data:</span>
            <span>{header.comanda_data ? formatDate(header.comanda_data) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Horário:</span>
            <span>{header.comanda_data ? formatTime(header.comanda_data) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Tipo:</span>
            <span className="uppercase">{header.comanda_tipo || '—'}</span>
          </div>
        </div>

        <Separator className="my-4 border-dashed border-black" />

        {/* Itens */}
        <div className="space-y-2 mb-4">
          {groupedItens.length === 0 ? (
            <div className="text-sm text-center">Nenhum item</div>
          ) : (
            groupedItens.map((item, index) => (
              <div key={index} className="text-sm">
                <div className="flex justify-between">
                  <span>{item.nome}</span>
                </div>
                <div className="flex justify-between ml-2">
                  <span>{formatNumber(item.kg, 2)}x R$ {item.precoMedio.toFixed(2)}</span>
                  <span className="font-bold">R$ {item.total.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <Separator className="my-4 border-dashed border-black" />

        {/* Total */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL:</span>
            <span>R$ {Number(totalCalculado).toFixed(2)}</span>
          </div>
        </div>

        <Separator className="my-4 border-dashed border-black" />

        {/* Rodapé */}
        <div className="text-center text-xs">
          <p>Obrigado</p>
          <p className="font-bold">DEUS SEJA LOUVADO!!!</p>
          <p className="mt-2">Versao 1.0</p>
        </div>
      </Card>

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
              console.log('[PreviewComanda] Iniciando geração de PDF...');
              toast({ description: "Gerando PDF..." as any });
              
              const result = await generateAndSaveComandaA4Pdf({
                header: {
                  codigo: header?.codigo ?? null,
                  comanda_data: header?.comanda_data ?? null,
                  comanda_tipo: header?.comanda_tipo ?? null,
                  observacoes: header?.observacoes ?? null,
                },
                groupedItens,
                total: Number(totalCalculado) || 0,
              });
              
              console.log('[PreviewComanda] PDF gerado com sucesso:', result);
              
              if (result?.usedDirectoryName === 'Downloads') {
                toast({ 
                  description: `PDF "${result.filename}" salvo em Downloads ✓` as any,
                  duration: 5000
                });
              } else {
                toast({ 
                  description: `PDF "${result.filename}" salvo com sucesso ✓` as any,
                  duration: 5000
                });
              }
            } catch (err) {
              console.error('[PreviewComanda] Erro ao gerar PDF:', err);
              const errorMsg = err instanceof Error ? err.message : String(err);
              toast({ 
                description: `Erro: ${errorMsg}. Verifique as permissões.` as any, 
                variant: "destructive" as any,
                duration: 7000
              });
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


