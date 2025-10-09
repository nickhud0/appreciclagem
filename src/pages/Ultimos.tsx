import { ArrowLeft, Clock, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { selectAll } from "@/database";
import { formatCurrency } from "@/utils/formatters";

const Ultimos = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const rows = await selectAll<any>('ultimas_20', 'data DESC');
        setItems(rows);
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
              <Card key={it.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground">Material #{it.material ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{new Date(it.data).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Kg: <span className="font-semibold">{it.kg_total ?? 0}</span></div>
                    <div className="text-sm">Total: <span className="font-semibold">{formatCurrency(it.valor_total || 0)}</span></div>
                    {it.origem_offline === 1 && (
                      <span className="inline-flex items-center text-[10px] text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded mt-1">
                        <CloudOff className="h-3 w-3 mr-1" /> pendente
                      </span>
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