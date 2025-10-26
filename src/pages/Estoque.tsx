import { ArrowLeft, Package, Search, CloudOff } from "lucide-react";
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

  const StatBlock = ({ title, value = "—", valueClassName, titleClassName, cardClassName }: { title: string; value?: string | number; valueClassName?: string; titleClassName?: string; cardClassName?: string }) => {
    return (
      <Card className={`bg-card rounded-2xl p-3 shadow-sm border border-border/10 flex flex-col items-center justify-center text-center ${cardClassName || ''}`}>
        <div className={`text-sm font-medium text-muted-foreground uppercase tracking-wide ${titleClassName || ''}`}>{title}</div>
        <div className={`mt-1 text-xl font-bold text-foreground ${valueClassName || ''}`}>{value}</div>
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

        {/* Título Resumo */}
        <h2 className="text-lg font-bold text-foreground px-3 mt-3 mb-1">Resumo Financeiro</h2>
        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
          <StatBlock
            title="KG"
            value={resumo?.total_kg != null ? formatWeight(Number(resumo.total_kg) || 0) : '—'}
            titleClassName="text-blue-300"
            cardClassName="bg-blue-500/10"
          />
          <StatBlock
            title="Custo"
            value={resumo?.total_custo != null ? formatCurrency(Number(resumo.total_custo) || 0) : '—'}
            titleClassName="text-red-300"
            cardClassName="bg-red-500/10"
          />
          <StatBlock
            title="Potencial"
            value={resumo?.total_venda_potencial != null ? formatCurrency(Number(resumo.total_venda_potencial) || 0) : '—'}
            titleClassName="text-emerald-300"
            cardClassName="bg-emerald-500/10"
          />
          <StatBlock
            title="Lucro"
            value={resumo?.lucro_potencial != null ? formatCurrency(Number(resumo.lucro_potencial) || 0) : '—'}
            valueClassName={
              resumo?.lucro_potencial == null
                ? 'text-muted-foreground'
                : Number(resumo.lucro_potencial) > 0
                  ? 'text-emerald-500'
                  : Number(resumo.lucro_potencial) < 0
                    ? 'text-red-500'
                    : 'text-muted-foreground'
            }
            titleClassName={
              resumo?.lucro_potencial == null
                ? ''
                : Number(resumo.lucro_potencial) > 0
                  ? 'text-emerald-300'
                  : Number(resumo.lucro_potencial) < 0
                    ? 'text-red-300'
                    : ''
            }
            cardClassName={
              resumo?.lucro_potencial == null
                ? 'bg-card'
                : Number(resumo.lucro_potencial) > 0
                  ? 'bg-emerald-500/10'
                  : Number(resumo.lucro_potencial) < 0
                    ? 'bg-red-500/10'
                    : 'bg-card'
            }
          />
        </div>
        {resumo?.updated_at ? (
          <div className="text-xs text-muted-foreground px-3 mt-2 mb-3">Atualizado em: {formatDateTime(resumo.updated_at)}</div>
        ) : (
          <div className="mb-3" />
        )}

        {/* Título Materiais */}
        <h2 className="text-lg font-bold text-foreground px-3 mt-2 mb-2">Materiais em Estoque</h2>

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
              <Card key={item.material} className="bg-card/60 border border-border/20 rounded-2xl p-4 shadow-sm backdrop-blur-md">
                <div className="space-y-3">
                  {/* Nome do Material */}
                  <div className="text-lg font-bold text-foreground leading-tight">
                    {item.material}
                  </div>
                  
                  {/* Informações do Material */}
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">KG:</span>
                      <span className="font-semibold text-primary">{formatWeight(item.kg_total || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Médio:</span>
                      <span className="font-semibold text-primary">{formatCurrency(item.valor_medio_kg || 0)}/kg</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total:</span>
                      <span className="font-semibold text-primary">{formatCurrency(item.valor_total_gasto || 0)}</span>
                    </div>
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