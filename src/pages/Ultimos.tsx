import { ArrowLeft, Clock, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { selectAll, selectWhere, executeQuery } from "@/database";
import { formatCurrency } from "@/utils/formatters";
import { logger } from "@/utils/logger";

const Ultimos = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function formatDateShort(value: any): string {
    try {
      const d = new Date(value);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm} • ${hh}:${mi}`;
    } catch {
      return '';
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const confirmadas = await selectAll<any>('ultimas_20', 'data DESC');

        const pendentesRows = await selectWhere<any>(
          'sync_queue',
          'synced = ? AND table_name = ? AND operation = ?',
          [0, 'item', 'INSERT'],
          'created_at DESC'
        );

        const pendentes = (pendentesRows || []).map((row: any) => {
          let payload: any = {};
          try {
            const parsed = JSON.parse(row.payload || '{}');
            payload = parsed && typeof parsed === 'object' ? parsed : {};
          } catch (e) {
            // ignore invalid json
          }
          const materialId = Number(
            payload.material ?? payload.material_id ?? payload.materialId ?? 0
          ) || 0;
          const kgTotal = Number(payload.kg_total ?? payload.kg ?? 0) || 0;
          const valorTotal = Number(payload.valor_total ?? payload.total ?? payload.item_valor_total ?? 0) || 0;
          const precoKg = Number(payload.preco_kg ?? payload.precoKg ?? payload.preco ?? 0) || 0;

          return {
            id: `pending-${row.id}`,
            record_id: row.record_id,
            data: payload.data || payload.item_data || row.created_at,
            material: materialId || null,
            material_nome: '',
            kg_total: kgTotal,
            valor_total: valorTotal,
            preco_kg: precoKg,
            client_uuid: payload.client_uuid || payload.uuid || null,
            __pending: true,
            origem_offline: 1
          } as any;
        });

        // Resolve material names
        const neededMaterialIds = new Set<number>();
        for (const c of (confirmadas || [])) {
          const mid = Number(c.material) || 0;
          if (mid > 0) neededMaterialIds.add(mid);
        }
        for (const p of pendentes) {
          const mid = Number(p.material) || 0;
          if (mid > 0) neededMaterialIds.add(mid);
        }

        const idList = Array.from(neededMaterialIds);
        const idToName = new Map<number, string>();
        if (idList.length > 0) {
          const placeholders = idList.map(() => '?').join(',');
          try {
            const mats = await executeQuery<{ id: number; nome: string }>(
              `SELECT id, nome FROM material WHERE id IN (${placeholders})`,
              idList
            );
            for (const m of mats) idToName.set(Number(m.id), m.nome);
          } catch (e) {
            logger.warn('Falha ao carregar nomes de materiais', e);
          }
        }

        const confirmadasResolved = (confirmadas || []).map((c: any) => ({
          ...c,
          material_nome: idToName.get(Number(c.material) || 0) || 'Desconhecido',
          preco_kg: Number(c.preco_kg) || 0,
          __pending: false,
          client_uuid: null
        }));
        const pendentesResolved = (pendentes || []).map((p: any) => ({
          ...p,
          material_nome: p.material ? (idToName.get(Number(p.material) || 0) || 'Desconhecido') : 'Desconhecido'
        }));

        function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
        function normalizeDateMinute(d: any): string {
          try {
            const dt = new Date(d);
            const y = dt.getFullYear();
            const m = pad(dt.getMonth() + 1);
            const day = pad(dt.getDate());
            const hh = pad(dt.getHours());
            const mm = pad(dt.getMinutes());
            return `${y}-${m}-${day} ${hh}:${mm}`;
          } catch {
            return String(d || '');
          }
        }
        function compositeKey(materialId: number, kg: number, preco: number, d: any): string {
          return `${materialId}|${kg.toFixed(3)}|${preco.toFixed(3)}|${normalizeDateMinute(d)}`;
        }
        function getAllKeys(entry: any): string[] {
          const keys: string[] = [];
          if (entry?.client_uuid) keys.push(`uuid:${entry.client_uuid}`);
          if (entry?.id && !String(entry.id).startsWith('pending-')) keys.push(`id:${entry.id}`);
          const materialId = Number(entry.material) || 0;
          const kg = Number(entry.kg_total) || 0;
          const preco = Number(entry.preco_kg) || 0;
          keys.push(`f:${compositeKey(materialId, kg, preco, entry.data)}`);
          return keys;
        }

        function getLooseKey(entry: any): string {
          const kg = Number(entry.kg_total) || 0;
          const preco = Number(entry.preco_kg) || 0;
          return `lf:${kg.toFixed(3)}|${preco.toFixed(3)}|${normalizeDateMinute(entry.data)}`;
        }

        function hasRealName(e: any): boolean {
          return !!(e?.material_nome && e.material_nome !== 'Desconhecido');
        }

        function rank(e: any): number {
          if (!e.__pending && hasRealName(e)) return 4; // confirmed + real name
          if (!e.__pending && !hasRealName(e)) return 3; // confirmed + unknown name
          if (e.__pending && hasRealName(e)) return 2; // pending + real name
          return 1; // pending + unknown name
        }

        const candidates = [...confirmadasResolved, ...pendentesResolved].sort((a: any, b: any) => {
          const rdiff = rank(b) - rank(a);
          if (rdiff !== 0) return rdiff;
          const da = a?.data ? new Date(a.data).getTime() : 0;
          const db = b?.data ? new Date(b.data).getTime() : 0;
          return db - da;
        });

        const seen = new Set<string>();
        const seenLoose = new Set<string>();
        const unique: any[] = [];
        for (const e of candidates) {
          const keys = getAllKeys(e);
          let duplicate = false;
          for (const k of keys) {
            if (seen.has(k)) { duplicate = true; break; }
          }
          if (!duplicate && !hasRealName(e)) {
            const lk = getLooseKey(e);
            if (seenLoose.has(lk)) duplicate = true;
          }
          if (duplicate) continue;
          unique.push(e);
          for (const k of keys) seen.add(k);
          const lk = getLooseKey(e);
          seenLoose.add(lk);
        }

        const unificada = unique.sort((a: any, b: any) => {
          const da = a?.data ? new Date(a.data).getTime() : 0;
          const db = b?.data ? new Date(b.data).getTime() : 0;
          return db - da;
        }).slice(0, 20);

        setItems(unificada);
      } catch (error) {
        logger.error('Erro ao carregar últimos itens:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Últimos Itens</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <Clock className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Histórico Recente</h2>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Nenhum item recente</h3>
            <p className="text-muted-foreground">Os últimos lançamentos aparecerão aqui.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <Card key={it.id} className="p-4 rounded-xl border border-border/20 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-foreground truncate" title={it.material_nome || 'Desconhecido'}>
                      {it.material_nome || 'Desconhecido'}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${Number(it.kg_total) >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                        {Number(it.kg_total) >= 0 ? 'Compra' : 'Venda'}
                      </span>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {Math.abs(Number(it.kg_total) || 0)} kg • {formatCurrency(Number(it.preco_kg) || 0)}/kg
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDateShort(it.data)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(Number(it.valor_total) || 0)}</div>
                    {(it.__pending || it.origem_offline === 1) && (
                      <CloudOff className="h-4 w-4 text-yellow-500 inline-block mt-1" title="Pendente de sincronização" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Ultimos;