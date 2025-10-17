import { ArrowLeft, BarChart3, CalendarDays, CalendarRange, CalendarClock } from "lucide-react";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { selectAll } from "@/database";

const Relatorios = () => {
  const navigate = useNavigate();
  const [diario, setDiario] = useState<any[]>([]);
  const [mensal, setMensal] = useState<any[]>([]);
  const [anual, setAnual] = useState<any[]>([]);
  const [compraDia, setCompraDia] = useState<any[]>([]);
  const [vendaDia, setVendaDia] = useState<any[]>([]);
  const [compraMes, setCompraMes] = useState<any[]>([]);
  const [vendaMes, setVendaMes] = useState<any[]>([]);
  const [compraAno, setCompraAno] = useState<any[]>([]);
  const [vendaAno, setVendaAno] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setDiario(await selectAll('relatorio_diario', 'data DESC'));
      setMensal(await selectAll('relatorio_mensal', 'referencia DESC'));
      setAnual(await selectAll('relatorio_anual', 'referencia DESC'));
      setCompraDia(await selectAll('compra_por_material_diario', 'data DESC'));
      setVendaDia(await selectAll('venda_por_material_diario', 'data DESC'));
      setCompraMes(await selectAll('compra_por_material_mes', 'referencia DESC'));
      setVendaMes(await selectAll('venda_por_material_mes', 'referencia DESC'));
      setCompraAno(await selectAll('compra_por_material_anual', 'referencia DESC'));
      setVendaAno(await selectAll('venda_por_material_anual', 'referencia DESC'));
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
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-5 sm:p-6 bg-card rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary mr-2 sm:mr-3" />
            <h2 className="text-xl font-bold">Relatórios</h2>
          </div>
        </div>

        <Tabs defaultValue="diario" className="w-full">
          <TabsList className="mb-4 grid grid-cols-3">
            <TabsTrigger value="diario" className="text-sm">Diário</TabsTrigger>
            <TabsTrigger value="mensal" className="text-sm">Mensal</TabsTrigger>
            <TabsTrigger value="anual" className="text-sm">Anual</TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="space-y-4">
            <SectionHeader icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />} title="Relatório Diário" />
            <div className="grid grid-cols-1 gap-3">
              <MetricsPanel rows={diario} labels={["compra","venda","despesa","lucro"]} dateKey="data" />
              <MaterialListPanel title="Compra por Material (Dia)" rows={compraDia} />
              <MaterialListPanel title="Venda por Material (Dia)" rows={vendaDia} />
            </div>
          </TabsContent>

          <TabsContent value="mensal" className="space-y-4">
            <SectionHeader icon={<CalendarRange className="h-4 w-4 text-muted-foreground" />} title="Relatório Mensal" />
            <div className="grid grid-cols-1 gap-3">
              <MetricsPanel rows={mensal} labels={["compra","venda","despesa","lucro"]} dateKey="referencia" />
              <MaterialListPanel title="Compra por Material (Mês)" rows={compraMes} />
              <MaterialListPanel title="Venda por Material (Mês)" rows={vendaMes} />
            </div>
          </TabsContent>

          <TabsContent value="anual" className="space-y-4">
            <SectionHeader icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />} title="Relatório Anual" />
            <div className="grid grid-cols-1 gap-3">
              <MetricsPanel rows={anual} labels={["compra","venda","despesa","lucro"]} dateKey="referencia" />
              <MaterialListPanel title="Compra por Material (Ano)" rows={compraAno} />
              <MaterialListPanel title="Venda por Material (Ano)" rows={vendaAno} />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-xl font-bold">{title}</h3>
    </div>
  );
}

function MetricsPanel({ rows, labels, dateKey }: { rows: any[]; labels: string[]; dateKey: string }) {
  if (!rows || rows.length === 0) {
    return (
      <Card className="p-4 bg-card rounded-lg shadow-sm">
        <div className="text-sm text-muted-foreground">Sem dados.</div>
      </Card>
    );
  }

  const latest = rows[0] || {};
  const compra = Number(latest['compra'] ?? 0) || 0;
  const venda = Number(latest['venda'] ?? 0) || 0;
  const despesa = Number(latest['despesa'] ?? 0) || 0;
  const lucro = Number(latest['lucro'] ?? 0) || 0;

  const lucroClass = lucro >= 0 ? 'text-green-700' : 'text-red-700';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-card rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground">Referência</div>
          <div className="text-lg font-semibold text-primary">{latest[dateKey] ?? '—'}</div>
        </Card>
        <Card className="p-4 bg-green-50 rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground">Vendas</div>
          <div className="text-lg font-semibold text-green-600">{formatCurrency(venda)}</div>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-amber-50 rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground">Compras</div>
          <div className="text-lg font-semibold text-amber-600">{formatCurrency(compra)}</div>
        </Card>
        <Card className="p-4 bg-red-50 rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground">Despesas</div>
          <div className="text-lg font-semibold text-red-600">{formatCurrency(despesa)}</div>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-card rounded-lg shadow-sm col-span-2">
          <div className="text-sm text-muted-foreground">Lucro</div>
          <div className={`text-lg font-semibold ${lucroClass}`}>{formatCurrency(lucro)}</div>
        </Card>
      </div>
    </div>
  );
}

function DataPanel({ title, rows, cols }: { title: string; rows: any[]; cols: string[] }) {
  return (
    <Card className="p-4 bg-card rounded-lg shadow-sm">
      <div className="mb-2">
        <h4 className="text-base font-semibold">{title}</h4>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sem dados.</div>
      ) : (
        <div className="overflow-hidden">
          <div className="divide-y">
            {rows.map((r, idx) => (
              <div key={idx} className="py-2 grid grid-cols-1 gap-1">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {cols.map((c) => (
                    <div key={c} className="flex flex-col">
                      <span className="text-sm text-muted-foreground capitalize">{c.replace('_',' ')}</span>
                      <span className="text-sm font-medium">{r[c] ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function MaterialListPanel({ title, rows }: { title: string; rows: any[] }) {
  return (
    <Card className="p-4 bg-card rounded-lg shadow-sm">
      <div className="mb-2">
        <h4 className="text-base font-semibold">{title}</h4>
      </div>
      {(!rows || rows.length === 0) ? (
        <div className="text-sm text-muted-foreground">Sem dados.</div>
      ) : (
        <div className="divide-y">
          {rows.map((r: any, idx: number) => {
            const nome = r?.nome ?? r?.material ?? '—';
            const kg = Number(r?.kg ?? r?.kg_total ?? 0) || 0;
            const total = Number(r?.gasto ?? r?.valor ?? r?.valor_total ?? 0) || 0;
            return (
              <div key={idx} className="py-2 flex items-center justify-between gap-3">
                <div className="font-semibold truncate">{nome}</div>
                <div className="text-sm text-muted-foreground whitespace-nowrap">{formatNumber(kg, 2)} kg</div>
                <div className="text-sm font-semibold text-primary whitespace-nowrap">{formatCurrency(total)}</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default Relatorios;