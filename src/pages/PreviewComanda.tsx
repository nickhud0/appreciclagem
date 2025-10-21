import { ArrowLeft, Printer, MessageCircle, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { executeQuery } from "@/database";
import { formatCurrency, formatDateTime, formatNumber } from "@/utils/formatters";

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
    void loadLatestComanda();
  }, []);

  const totalCalculado = useMemo(() => {
    if (header?.comanda_total != null) return header.comanda_total;
    return itens.reduce((acc, it) => acc + (Number(it.item_valor_total) || 0), 0);
  }, [header, itens]);

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
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Pré-visualização da Comanda</h1>
        </div>
      </div>

      {/* Cupom térmico 58mm */}
      <div className="flex justify-center">
        <div className="mx-auto w-[230px] bg-white text-black p-3 rounded-lg shadow-sm font-mono leading-tight">
          {/* Cabeçalho do cupom */}
          <div className="text-center text-[13px] font-bold">Reciclagem Pereque</div>
          <div className="text-center">------------------------------</div>
          <div className="text-center text-[12px]">
            <div className="font-bold">{header.codigo || '—'}</div>
            <div>{header.comanda_data ? formatDateTime(header.comanda_data) : '—'}</div>
            <div className="uppercase">{header.comanda_tipo || '—'}</div>
          </div>

          <div className="text-center">------------------------------</div>

          {/* Itens */}
          {itens.length === 0 ? (
            <div className="text-center text-[12px]">Nenhum item</div>
          ) : (
            <div className="space-y-1">
              {itens.map((it, idx) => {
                const nome = it.material_nome || `#${it.material_id ?? ''}`;
                const kg = `${formatNumber(Number(it.kg_total || 0), 3)} kg`;
                const preco = formatCurrency(Number(it.preco_kg) || 0);
                const total = formatCurrency(Number(it.item_valor_total) || 0);
                return (
                  <div key={idx} className="text-[12px] whitespace-normal break-words">
                    {`${nome} ${kg} x ${preco} = ${total}`}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-2">------------------------------</div>

          {/* Totais */}
          <div className="text-center text-[13px] font-bold">
            TOTAL: {formatCurrency(Number(totalCalculado) || 0)}
          </div>
          {header.observacoes ? (
            <div className="text-center mt-1 text-[11px] italic whitespace-pre-wrap">
              {header.observacoes}
            </div>
          ) : null}

          <div className="text-center mt-2">------------------------------</div>

          {/* Rodapé do cupom */}
          <div className="text-center italic text-gray-500 text-sm">Deus seja louvado.</div>
        </div>
      </div>

      {/* Ações abaixo do cupom */}
      <div className="mt-4">
        <Card className="rounded-xl border border-border/20 shadow-md p-4">
          <div className="grid grid-cols-3 gap-3">
            <Button variant="outline" className="w-full">
              <MessageCircle className="h-4 w-4 mr-2 text-emerald-500" /> WhatsApp
            </Button>
            <Button variant="outline" className="w-full">
              <FileText className="h-4 w-4 mr-2 text-blue-500" /> PDF
            </Button>
            <Button variant="outline" className="w-full">
              <Printer className="h-4 w-4 mr-2 text-foreground" /> Imprimir
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PreviewComanda;


