import { ArrowLeft, BarChart3 } from "lucide-react";
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
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <BarChart3 className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Relatórios e Análises</h2>
        </div>

        <Tabs defaultValue="diario" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="diario">Diário</TabsTrigger>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
            <TabsTrigger value="anual">Anual</TabsTrigger>
            {/* Personalizado via RPC: implementável futuramente */}
          </TabsList>

          <TabsContent value="diario">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Resumo Diário" rows={diario} cols={["data","compra","venda","despesa","lucro"]} />
              <Section title="Compra por Material (Dia)" rows={compraDia} cols={["data","nome","kg","gasto"]} />
              <Section title="Venda por Material (Dia)" rows={vendaDia} cols={["data","nome","kg","gasto"]} />
            </div>
          </TabsContent>

          <TabsContent value="mensal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Resumo Mensal" rows={mensal} cols={["referencia","compra","venda","despesa","lucro"]} />
              <Section title="Compra por Material (Mês)" rows={compraMes} cols={["referencia","nome","kg","gasto"]} />
              <Section title="Venda por Material (Mês)" rows={vendaMes} cols={["referencia","nome","kg","gasto"]} />
            </div>
          </TabsContent>

          <TabsContent value="anual">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Resumo Anual" rows={anual} cols={["referencia","compra","venda","despesa","lucro"]} />
              <Section title="Compra por Material (Ano)" rows={compraAno} cols={["referencia","nome","kg","gasto"]} />
              <Section title="Venda por Material (Ano)" rows={vendaAno} cols={["referencia","nome","kg","gasto"]} />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

function Section({ title, rows, cols }: { title: string; rows: any[]; cols: string[] }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sem dados.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                {cols.map((c) => (
                  <th key={c} className="py-2 pr-4 capitalize">{c.replace('_',' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-t">
                  {cols.map((c) => (
                    <td key={c} className="py-2 pr-4">{r[c] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default Relatorios;