import { ArrowLeft, Package, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { selectAll, executeQuery } from "@/database";
import { formatCurrency, formatWeight, formatDateTime } from "@/utils/formatters";
import { onSyncStatus, type SyncStatus } from "@/services/syncEngine";
import type { Estoque as EstoqueRow } from "@/database";

const Estoque = () => {
  const navigate = useNavigate();
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  type ResumoEstoqueFinanceiro = {
    total_kg: number | null;
    total_custo: number | null;
    total_venda_potencial: number | null;
    lucro_potencial: number | null;
    updated_at?: string | null;
  };
  const [resumo, setResumo] = useState<ResumoEstoqueFinanceiro | null>(null);
  

  const refresh = useCallback(async () => {
    const rows = await selectAll<EstoqueRow>('estoque', 'material ASC');
    setEstoque(rows);

    try {
      const resumoRows = await executeQuery<ResumoEstoqueFinanceiro>(
        'SELECT total_kg, total_custo, total_venda_potencial, lucro_potencial, updated_at FROM resumo_estoque_financeiro LIMIT 1'
      );
      setResumo(resumoRows[0] ?? null);
    } catch {
      setResumo(null);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        await refresh();
      } finally {
        setLoading(false);
      }
    }
    void loadInitial();
  }, [refresh]);

  // Silent background refresh after a successful sync cycle
  const prevStatusRef = useRef<SyncStatus | null>(null);
  useEffect(() => {
    const off = onSyncStatus((status) => {
      const prev = prevStatusRef.current;
      if (prev && prev.syncing && !status.syncing && !status.lastError) {
        void refresh();
      }
      prevStatusRef.current = status;
    });
    return () => off();
  }, [refresh]);

  const filtrado = useMemo(() => {
    const q = busca.toLowerCase();
    return estoque.filter((e) => (e.material || '').toLowerCase().includes(q));
  }, [estoque, busca]);

  const StatBlock = ({ title, value = "—", valueClassName }: { title: string; value?: string | number; valueClassName?: string }) => {
    return (
      <Card className="p-3 shadow-card">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`mt-1 text-xl font-bold ${valueClassName || ''}`}>{value}</div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <Package className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Controle de Estoque</h2>
        </div>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar material no estoque..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Indicadores (visual somente) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
          <StatBlock
            title="KG"
            value={resumo?.total_kg != null ? formatWeight(Number(resumo.total_kg) || 0) : '—'}
          />
          <StatBlock
            title="Custo"
            value={resumo?.total_custo != null ? formatCurrency(Number(resumo.total_custo) || 0) : '—'}
          />
          <StatBlock
            title="Potencial"
            value={resumo?.total_venda_potencial != null ? formatCurrency(Number(resumo.total_venda_potencial) || 0) : '—'}
          />
          <StatBlock
            title="Lucro"
            value={resumo?.lucro_potencial != null ? formatCurrency(Number(resumo.lucro_potencial) || 0) : '—'}
            valueClassName={
              resumo?.lucro_potencial == null
                ? 'text-muted-foreground'
                : Number(resumo.lucro_potencial) > 0
                  ? 'text-success'
                  : Number(resumo.lucro_potencial) < 0
                    ? 'text-destructive'
                    : 'text-muted-foreground'
            }
          />
        </div>
        {resumo?.updated_at ? (
          <div className="text-xs text-muted-foreground mb-6">Atualizado em: {formatDateTime(resumo.updated_at)}</div>
        ) : (
          <div className="mb-6" />
        )}

        {loading ? (
          <div className="text-center text-muted-foreground">Carregando...</div>
        ) : filtrado.length === 0 ? (
          <Card className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Nenhum item encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar a busca.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtrado.map((item) => (
              <Card key={item.material} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground">{item.material}</div>
                    <div className="text-xs text-muted-foreground">Valor médio/kg: {formatCurrency(item.valor_medio_kg || 0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Kg total: <span className="font-semibold">{item.kg_total ?? 0}</span></div>
                    <div className="text-sm">Total gasto: <span className="font-semibold">{formatCurrency(item.valor_total_gasto || 0)}</span></div>
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

export default Estoque;