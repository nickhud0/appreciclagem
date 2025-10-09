import { ArrowLeft, Package, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { selectAll } from "@/database";
import { formatCurrency } from "@/utils/formatters";

const Estoque = () => {
  const navigate = useNavigate();
  const [estoque, setEstoque] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const rows = await selectAll<any>('estoque', 'material ASC');
        setEstoque(rows);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtrado = useMemo(() => {
    const q = busca.toLowerCase();
    return estoque.filter((e) => (e.material || '').toLowerCase().includes(q));
  }, [estoque, busca]);

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