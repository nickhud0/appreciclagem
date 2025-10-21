import { ArrowLeft, History, CloudOff, Receipt, ShoppingCart, Coins, Calendar, Package, Scale, DollarSign, Smartphone, Clock, Hash, X } from "lucide-react";
import { Device } from '@capacitor/device';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { selectAll, selectWhere } from "@/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/services/supabaseClient";
import { getSyncStatus } from "@/services/syncEngine";

const DEBUG_HISTORICO = false;
function dbg(...args: any[]) {
  // debug logging disabled for silent UX
}
function getPendingComandaKey(payload: any, fallback?: string | number | null): string | null {
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
}

function getDisplayCodigo(row: any): string {
  const codigo = row?.codigo ?? row?.code;
  return codigo ? String(codigo) : '';
}

const HistoricoComandas = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [materialsById, setMaterialsById] = useState<Record<number, any>>({});
  const { toast } = useToast();
  const [debugCounts, setDebugCounts] = useState<{ confirmed: number; pendingComandas: number; pendingItems: number; finalList: number } | null>(null);
  const [pendingItemsByKey, setPendingItemsByKey] = useState<Record<string, any[]>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Load confirmed comandas (already synced)
        const confirmed = await selectAll<any>('comanda_20', 'comanda_data DESC');
        dbg('confirmed count =', confirmed.length, 'sample =', confirmed.slice(0, 2));

        // Load pending comandas and items from sync_queue (offline inserts)
        const pendingComandaInserts = await selectWhere<any>(
          'sync_queue',
          'synced = ? AND table_name = ? AND operation = ?',
          [0, 'comanda', 'INSERT'],
          'created_at DESC'
        );
        dbg('pending comanda inserts =', pendingComandaInserts.length, 'payload samples =', pendingComandaInserts.slice(0, 3).map((r: any) => r?.payload));

        const pendingItemInserts = await selectWhere<any>(
          'sync_queue',
          'synced = ? AND table_name = ? AND operation = ?',
          [0, 'item', 'INSERT'],
          'created_at ASC'
        );
        dbg('pending item inserts =', pendingItemInserts.length, 'payload samples =', pendingItemInserts.slice(0, 3).map((r: any) => r?.payload));
        if (DEBUG_HISTORICO) {
          const sampleKeys = pendingItemInserts.slice(0, 3).map((r: any) => {
            try { const p = JSON.parse(r.payload || '{}'); return Object.keys(p); } catch { return []; }
          });
          dbg('pending item payload keys (first 3) =', sampleKeys);
        }

        // Also support pending rows captured as 'ultimas_20' inserts
        const pendingUltimasInserts = await selectWhere<any>(
          'sync_queue',
          'synced = ? AND table_name = ? AND operation = ?',
          [0, 'ultimas_20', 'INSERT'],
          'created_at ASC'
        );
        dbg('pending ultimas_20 inserts =', pendingUltimasInserts.length, 'payload samples =', pendingUltimasInserts.slice(0, 3).map((r: any) => r?.payload));

        const safeParse = (s: string) => {
          try { return JSON.parse(s || '{}'); } catch { return {}; }
        };

        // Group pending items by normalized comanda key
        const itemsByKey: Record<string, any[]> = {};
        for (const it of pendingItemInserts) {
          const payload = safeParse(it.payload);
          const key = getPendingComandaKey(payload, null);
          if (key == null) { dbg('WARN item without comanda key (ignored)', payload); continue; }
          if (!itemsByKey[key]) itemsByKey[key] = [];
          itemsByKey[key].push({ ...payload, __queueCreatedAt: it.created_at, __syncId: it.id, __table: 'item', __source: 'sync_queue' });
        }

        // Also fold pending 'ultimas_20' rows into items when they reference a comanda
        for (const row of pendingUltimasInserts) {
          const payload = safeParse(row.payload);
          const key = getPendingComandaKey(payload, payload.comanda ?? payload.comanda_id ?? null);
          if (key == null) continue; // ignore loose items not linked to a comanda
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

        // Build pending comandas map using normalized key
        const pendingComandasMap: Record<string, any> = {};
        for (const row of pendingComandaInserts) {
          const payload = safeParse(row.payload);
          const localFallback = row.record_id ?? payload.id ?? payload.local_id ?? payload.temp_id ?? row.id;
          const key = getPendingComandaKey(payload, localFallback);
          if (key == null) { dbg('WARN comanda insert without key', payload); continue; }
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
        // Attach items to pending comandas by key; create synthetic groups for keys that only exist in items
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

        // Group confirmed rows by comanda_id
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
          confirmedGroupsMap[key].items.push({
            item_id: r.item_id ?? null,
            material_id: r.material_id ?? null,
            kg_total: r.kg_total ?? 0,
            preco_kg: r.preco_kg ?? 0,
            item_valor_total: r.item_valor_total ?? 0,
            __source: 'confirmed'
          });
        }

        const confirmedGroups = Object.values(confirmedGroupsMap).map((g: any) => ({
          ...g,
          comanda_total: g.items.reduce((acc: number, it: any) => acc + (Number(it.item_valor_total) || 0), 0)
        }));

        // Build pending groups from pendingRows (group by comanda_id)
        // Build pending groups with totals; keep comanda if it has any items
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

        // Deduplicate by codigo first, fallback to comanda_id/key, prefer confirmed
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

        const unifiedGroups = [...confirmedGroups, ...pendingFiltered].sort((a: any, b: any) => {
          const da = a.comanda_data ? new Date(a.comanda_data).getTime() : 0;
          const db = b.comanda_data ? new Date(b.comanda_data).getTime() : 0;
          return db - da;
        });

        setRows(unifiedGroups);
        // Normalize pending items by codigo for popup usage
        try {
          const mapByKey: Record<string, any[]> = {};
          for (const g of pendingGroups as any[]) {
            const key = (g.codigo && String(g.codigo)) || String(g.comanda_id || g.comanda_key || '');
            if (!key) continue;
            if (!mapByKey[key]) mapByKey[key] = [];
            mapByKey[key].push(...g.items);
          }
          setPendingItemsByKey(mapByKey);
        } catch {}
        // Update tiny debug counts
        try {
          const pendingItemsCount = Object.values(itemsByKey).reduce((a, b: any) => a + (Array.isArray(b) ? b.length : 0), 0);
          setDebugCounts({ confirmed: confirmedGroups.length, pendingComandas: pendingGroups.length, pendingItems: pendingItemsCount, finalList: unifiedGroups.length });
        } catch {}
      } catch (err: any) {
        if (DEBUG_HISTORICO) {
          // eslint-disable-next-line no-console
          console.error('[Historico] load error', err);
        }
        toast({ title: 'Não foi possível carregar o histórico', variant: 'destructive' as any });
        try {
          // Fallback: confirmed-only list
          const confirmed = await selectAll<any>('comanda_20', 'comanda_data DESC');
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
            confirmedGroupsMap[key].items.push({
              material_id: r.material_id ?? null,
              kg_total: r.kg_total ?? 0,
              preco_kg: r.preco_kg ?? 0,
              item_valor_total: r.item_valor_total ?? 0,
              __source: 'confirmed'
            });
          }
          const confirmedGroups = Object.values(confirmedGroupsMap).map((g: any) => ({
            ...g,
            comanda_total: g.items.reduce((acc: number, it: any) => acc + (Number(it.item_valor_total) || 0), 0)
          }));
          setRows(confirmedGroups);
          setDebugCounts({ confirmed: confirmedGroups.length, pendingComandas: 0, pendingItems: 0, finalList: confirmedGroups.length });
        } catch {
          setRows([]);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function normalizeText(v: any): string {
    try { return (v == null ? '' : String(v)).toLowerCase(); } catch { return ''; }
  }

  function rowMatchesTerm(row: any, term: string): boolean {
    const t = term.trim().toLowerCase();
    if (!t) return true;
    const codigo = normalizeText(getDisplayCodigo(row));
    const obs = normalizeText(row?.observacoes ?? '');
    const dataStr = row?.comanda_data ? new Date(row.comanda_data).toLocaleString().toLowerCase() : '';
    return codigo.includes(t) || obs.includes(t) || dataStr.includes(t);
  }

  async function performSearch(term: string) {
    const needle = term.trim();
    if (!needle) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      // Offline filtering from current unified rows (already combines local + pending)
      const offline = rows.filter((r) => rowMatchesTerm(r, needle));

      // Online search when possible
      const status = getSyncStatus();
      const client = status.isOnline && status.hasCredentials ? getSupabaseClient() : null;
      let remoteMapped: any[] = [];
      if (client) {
        const like = `%${needle}%`;
        const query = client
          .from('comanda')
          .select('id,data,codigo,tipo,observacoes,total')
          .or(`codigo.ilike.${like},observacoes.ilike.${like}`)
          .order('data', { ascending: false });
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          remoteMapped = data.map((r: any) => ({
            comanda_id: r.id,
            comanda_data: r.data,
            codigo: r.codigo,
            comanda_tipo: r.tipo,
            observacoes: r.observacoes ?? null,
            comanda_total: r.total ?? 0,
            origem_offline: 0,
            __is_pending: false,
            items: []
          }))
          // Additional client-side date match (for date search text)
          .filter((g: any) => rowMatchesTerm(g, needle));
        }
      }

      // Deduplicate by codigo (prefer offline/local entries)
      const seenCodes = new Set(offline.map((r) => getDisplayCodigo(r)).filter(Boolean));
      const remoteNoDup = remoteMapped.filter((g) => {
        const code = getDisplayCodigo(g);
        return code ? !seenCodes.has(code) : true;
      });

      const merged = [...offline, ...remoteNoDup];
      setSearchResults(merged);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function openItemsDialog(group: any, index: number) {
    // Determine codigo as primary key for item fetch/merge
    const codigo = getDisplayCodigo(group);
    const key = codigo || getPendingComandaKey(group, group?.comanda_id ?? null);
    setSelectedGroup({ ...group, __displayCodigo: codigo, __pendingKey: key });
    setIsItemsDialogOpen(true);
    // Resolve dispositivo (criado_por) for metadata
    let dispositivo = String(group?.criado_por || '').trim() || null;
    if (!dispositivo) {
      try {
        const info = await Device.getInfo();
        dispositivo = (info as any)?.name || (info as any)?.model || 'Dispositivo Desconhecido';
      } catch {
        dispositivo = 'Dispositivo Desconhecido';
      }
    }
    // Prepare date and time strings for verification log
    const dateObj = group?.comanda_data ? new Date(group.comanda_data) : null;
    const dataStr = dateObj ? dateObj.toLocaleDateString() : null;
    const horaStr = dateObj ? dateObj.toLocaleTimeString() : null;
    // Fetch material details for display (confirmed and pending items)
    try {
      const ids: number[] = Array.from(new Set(group.items.map((it: any) => Number(it.material_id)).filter((v: any) => Number.isFinite(v))));
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(', ');
        const rows = await selectWhere<any>('material', `id IN (${placeholders})`, ids);
        const map: Record<number, any> = {};
        for (const r of rows) {
          if (r && Number.isFinite(r.id)) map[Number(r.id)] = r;
        }
        setMaterialsById(map);
      } else {
        setMaterialsById({});
      }
    } catch {
      setMaterialsById({});
    }
    // Load confirmed items from local 'item' table (LEFT JOIN-like behavior via two-step) and merge with pending items keyed by codigo
    try {
      const resultItems: any[] = [];
      const confirmedItemsLocal: any[] = [];
      const pendingItemsLocal: any[] = [];
      // Confirmed items via local SQLite comanda_20 snapshot (view pull) joined with material for names
      const comandaId = group?.comanda_id ? Number(group.comanda_id) : NaN;
      if (!Number.isNaN(comandaId) && comandaId) {
        try {
          const confirmedRows = await selectWhere<any>('comanda_20', 'comanda_id = ?', [comandaId]);
          const materialIds = Array.from(new Set(confirmedRows.map((r: any) => Number(r.material_id)).filter((v: any) => Number.isFinite(v))));
          let materialMap: Record<number, any> = {};
          if (materialIds.length > 0) {
            const placeholders = materialIds.map(() => '?').join(', ');
            const mats = await selectWhere<any>('material', `id IN (${placeholders})`, materialIds);
            materialMap = Object.fromEntries(mats.map((m: any) => [Number(m.id), m]));
          }
          for (const r of confirmedRows) {
            const kg = Number(r.kg_total ?? 0) || 0;
            const preco = Number(r.preco_kg ?? 0) || 0;
            const total = Number(r.item_valor_total ?? (kg * preco)) || 0;
            if ((Number.isNaN(kg) || kg <= 0) && (Number.isNaN(total) || total <= 0)) continue;
            const matId = Number(r.material_id) || 0;
            const mat = materialMap[matId] || null;
            const itemNorm = {
              material_id: matId || null,
              material_nome: mat?.nome ?? '—',
              material_categoria: mat?.categoria ?? '—',
              kg_total: kg,
              preco_kg: preco,
              item_valor_total: total,
              __source: 'confirmed'
            };
            confirmedItemsLocal.push(itemNorm);
            resultItems.push(itemNorm);
          }
        } catch {}
      }
      // Pending items directly from sync_queue by codigo
      if (codigo) {
        try {
          const pendingItemRows = await selectWhere<any>('sync_queue', 'synced = ? AND table_name = ? AND operation = ?', [0, 'item', 'INSERT'], 'created_at ASC');
          const pendingParsed = pendingItemRows.map((r: any) => { try { return JSON.parse(r.payload || '{}'); } catch { return {}; } });
          const pendingForCodigo = pendingParsed.filter((p: any) => (p?.codigo ?? p?.code) === codigo);
          const matIds = Array.from(new Set(pendingForCodigo.map((p: any) => Number(p.material ?? p.material_id)).filter((v: any) => Number.isFinite(v))));
          let matMap: Record<number, any> = {};
          if (matIds.length > 0) {
            const placeholders = matIds.map(() => '?').join(', ');
            const mats = await selectWhere<any>('material', `id IN (${placeholders})`, matIds);
            matMap = Object.fromEntries(mats.map((m: any) => [Number(m.id), m]));
          }
          for (const p of pendingForCodigo) {
            const preco = Number(p.preco_kg ?? p.preco ?? 0) || 0;
            const kg = Number(p.kg_total ?? p.kg ?? 0) || 0;
            const total = Number(p.valor_total ?? p.total ?? (kg * preco)) || 0;
            if ((Number.isNaN(kg) || kg <= 0) && (Number.isNaN(total) || total <= 0)) continue;
            const matId = Number(p.material ?? p.material_id) || null;
            const mat = matId ? matMap[matId] : null;
            const itemNorm = {
              material_id: matId,
              material_nome: (mat?.nome ?? null) ?? (p.material_nome ?? p.nome_material ?? p.nome ?? '—'),
              material_categoria: (mat?.categoria ?? null) ?? (p.material_categoria ?? p.categoria ?? '—'),
              kg_total: kg,
              preco_kg: preco,
              item_valor_total: total,
              __source: 'sync_queue'
            };
            pendingItemsLocal.push(itemNorm);
            resultItems.push(itemNorm);
          }
        } catch {}
      }
      // debug logging disabled for silent UX
      setSelectedGroup(prev => prev ? { ...prev, items: resultItems, __dispositivo: dispositivo } : { ...group, items: resultItems, __dispositivo: dispositivo });
    } catch {}
  }

  // View-only popup: no edit handlers

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Histórico de Comandas</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-6 md:p-7">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Receipt className="h-6 w-6 text-primary mr-3" />
            <h2 className="text-lg font-semibold">Histórico de Comandas</h2>
          </div>
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-3">
            <span>Visual moderno e responsivo</span>
            {debugCounts && (
              <span className="text-[10px] text-muted-foreground/80">{`C:${debugCounts.confirmed} P:${debugCounts.pendingComandas} I:${debugCounts.pendingItems}`}</span>
            )}
          </div>
        </div>

        {/* Barra de busca */}
        <div className="mb-4 relative">
          <Input
            placeholder="Buscar por código, data ou observação..."
            value={searchTerm}
            onChange={(e) => { const v = e.target.value; setSearchTerm(v); void performSearch(v); }}
            className="pr-10"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => { setSearchTerm(''); setSearchResults([]); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Carregando...</div>
        ) : (searchTerm ? searchResults.length === 0 : rows.length === 0) ? (
          <Card className="p-6 text-center text-muted-foreground">Nenhuma comanda recente.</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(searchTerm ? searchResults : rows).map((c, idx) => {
              return (
                <Card
                  key={`${c.comanda_id ?? 'pending'}-${idx}`}
                  className={`group relative cursor-pointer rounded-2xl p-5 border hover:border-primary/30 shadow-sm hover:shadow-md transition-all duration-200 ease-out ${c.__is_pending ? 'pr-8' : ''}`}
                  onClick={() => openItemsDialog(c, idx)}
                >
                  {c.__is_pending && (
                    <CloudOff className="absolute right-3 top-3 h-4 w-4 text-orange-700" />
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <div className="text-base sm:text-lg font-bold text-foreground break-words">{getDisplayCodigo(c)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const t = String(c.comanda_tipo ?? '').trim().toLowerCase();
                        const label = !t ? null : (t.startsWith('c') || t === '0') ? 'Compra' : (t.startsWith('v') || t === '1') ? 'Venda' : null;
                        if (!label) return null;
                        const color = label === 'Compra' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200';
                        const Icon = label === 'Compra' ? ShoppingCart : Coins;
                        return (
                          <Badge className={`border ${color} px-2 py-0.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1`}>
                            <Icon className="h-3 w-3" /> {label}
                          </Badge>
                        );
                      })()}
                      {c.__is_pending && (
                        <Badge className="border bg-orange-100 text-orange-700 border-orange-200 px-2 py-0.5 rounded-full text-[11px] font-medium">Pendente</Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{c.comanda_data ? new Date(c.comanda_data).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Coins className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold">{c.comanda_total != null ? formatCurrency(Number(c.comanda_total) || 0) : '—'}</span>
                    </div>
                  </div>
                  {c.observacoes && (
                    <div className="mt-3 text-xs text-muted-foreground">Obs: {c.observacoes}</div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>
      {/* Dialog de Itens da Comanda */}
      <Dialog open={isItemsDialogOpen} onOpenChange={setIsItemsDialogOpen}>
        <DialogContent className="mx-auto max-w-2xl w-full rounded-2xl p-0 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
          {selectedGroup && (
            <div className="bg-background">
                <div className="border-b bg-muted/30 p-3 sm:p-4 md:p-5">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-lg font-bold text-foreground">Comanda {getDisplayCodigo(selectedGroup)}</h3>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {(() => {
                      const t = String(selectedGroup.comanda_tipo ?? '').trim().toLowerCase();
                      const label = !t ? null : (t.startsWith('c') || t === '0') ? 'Compra' : (t.startsWith('v') || t === '1') ? 'Venda' : null;
                      if (!label) return null;
                      const color = label === 'Compra' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200';
                      const Icon = label === 'Compra' ? ShoppingCart : Coins;
                      return (
                        <Badge className={`border ${color} px-2 py-0.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1`}>
                          <Icon className="h-3 w-3" /> {label}
                        </Badge>
                      );
                    })()}
                    {selectedGroup.__is_pending && (
                      <Badge className="border bg-orange-100 text-orange-700 border-orange-200 px-2 py-0.5 rounded-full text-[11px] font-medium">Pendente</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-6">
                {/* Metadata info card */}
                <div className="rounded-xl p-3 sm:p-4 shadow-sm bg-muted/20">
                  <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex flex-col items-start">
                      <div className="text-sm sm:text-base font-medium text-muted-foreground flex items-center gap-1">
                        <Smartphone className="h-4 w-4" />
                        <span>Dispositivo</span>
                      </div>
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate" title={selectedGroup.__dispositivo || '—'}>
                        {selectedGroup.__dispositivo || '—'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <div className="text-sm sm:text-base font-medium text-muted-foreground flex items-center gap-1">
                        <Hash className="h-4 w-4" />
                        <span>Código</span>
                      </div>
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate" title={getDisplayCodigo(selectedGroup) || '—'}>
                        {getDisplayCodigo(selectedGroup) || '—'}
                      </div>
                    </div>
                    <div className="flex flex-col items-start">
                      <div className="text-sm sm:text-base font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Data</span>
                      </div>
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate">
                        {selectedGroup.comanda_data ? new Date(selectedGroup.comanda_data).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <div className="text-sm sm:text-base font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Hora</span>
                      </div>
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate">
                        {selectedGroup.comanda_data ? new Date(selectedGroup.comanda_data).toLocaleTimeString() : '—'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-b border-border/30 my-3" />
                <div className="rounded-xl border bg-card overflow-hidden max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr] gap-2 md:gap-4 px-3 py-2 text-sm font-medium text-muted-foreground uppercase tracking-wide bg-muted/40 sticky top-0">
                    <div className="text-left">Material</div>
                    <div className="text-right">Kg</div>
                    <div className="text-right">Preço</div>
                    <div className="text-right">Total</div>
                  </div>
                  <div className="divide-y divide-muted-foreground/20">
                    {(() => {
                      // Agrupar em memória por material_id/nome
                      const groups = new Map<string, { nome: string; kg: number; total: number }>();
                      for (const it of (selectedGroup.items || [])) {
                        const material = materialsById[Number(it.material_id)] || null;
                        const nome = (it.material_nome ?? material?.nome ?? '—') as string;
                        const key = String(it.material_id ?? nome);
                        const kg = Number(it.kg_total) || 0;
                        const preco = Number(it.preco_kg) || 0;
                        const subtotal = Number(it.item_valor_total) || (kg * preco);
                        if (kg === 0 && subtotal === 0) continue;
                        const prev = groups.get(key) || { nome, kg: 0, total: 0 };
                        prev.nome = nome;
                        prev.kg += kg;
                        prev.total += subtotal;
                        groups.set(key, prev);
                      }
                      const merged = Array.from(groups.values());
                      return merged.map((g, i) => {
                        const precoMedio = g.kg > 0 ? g.total / g.kg : 0;
                        return (
                          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr] gap-2 md:gap-4 px-3 py-3 items-center hover:bg-muted/30 active:bg-muted/40 transition-colors border-b border-muted-foreground/20 last:border-b-0">
                            <div className="flex items-center gap-2 truncate">
                              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="text-base font-semibold text-foreground truncate" title={g.nome}>
                                {g.nome}
                              </div>
                            </div>
                            <div className="text-right tabular-nums whitespace-nowrap text-sm text-foreground/90">
                              {formatNumber(g.kg, 2)}
                            </div>
                            <div className="text-right tabular-nums whitespace-nowrap text-sm text-foreground/90">
                              {formatCurrency(precoMedio)}
                            </div>
                            <div className="text-right tabular-nums whitespace-nowrap text-sm font-semibold text-foreground">
                              {formatCurrency(g.total)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="px-3 py-3">
                    <div className="w-full text-center md:text-center p-3 sm:p-4 rounded-xl border border-accent/20 bg-accent/10 shadow-sm font-bold text-base md:text-lg text-foreground">
                      Total da Comanda: {formatCurrency(Number(selectedGroup.comanda_total) || 0)}
                    </div>
                  </div>
                </div>
                {/* No bottom close/save buttons to avoid duplicates; top-right X from dialog is used */}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoricoComandas;