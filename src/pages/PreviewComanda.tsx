import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  const [scale, setScale] = useState(1);
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

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

  const groupedItens = useMemo(() => {
    const map = new Map<string, { nome: string; kg: number; total: number }>();
    for (const it of itens) {
      const key = (it.material_id != null && !Number.isNaN(Number(it.material_id)))
        ? String(it.material_id)
        : (it.material_nome || '—');
      const nome = it.material_nome || `#${it.material_id ?? ''}`;
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

  // Escala automática para preencher a tela sem rolagem lateral
  const computeScale = useCallback(() => {
    try {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      const availableW = Math.max(0, vw - 32); // margens laterais
      const paperBase = 240; // largura base do papel (px)
      const sW = availableW / paperBase;

      // Ajuste por altura para evitar rolagem desnecessária
      const headerH = headerRef.current ? headerRef.current.offsetHeight : 0;
      const actionsH = actionsRef.current ? actionsRef.current.offsetHeight : 0;
      const contentH = receiptRef.current ? receiptRef.current.offsetHeight : 0;
      const verticalGaps = 24; // respiro adicional mais preciso
      const availableH = Math.max(0, vh - headerH - actionsH - verticalGaps);
      const sH = contentH > 0 ? (availableH / contentH) : sW;

      // Use o menor fator entre largura/altura e aplique fator de segurança (2%) para evitar corte
      let s = Math.min(sW, sH) * 0.98;
      s = Math.min(2.0, Math.max(1.0, s));
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
    <div className="flex flex-col items-center justify-start w-full min-h-screen bg-background overflow-y-auto pb-20">
      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Pré-visualização da Comanda</h1>
        </div>
      </div>

      {/* Cupom térmico 58mm fiel (largura fixa ~240px) com escala automática */}
      <div id="comanda-preview" className="w-full flex justify-center items-start px-4">
        <div className="w-[90%] max-w-sm bg-white text-black rounded-lg shadow-md overflow-y-auto max-h-[80vh] p-4">
          <div className="origin-top" style={{ transform: `scale(${scale})`, transformOrigin: 'top center', willChange: 'transform' }}>
            <div ref={receiptRef} className="w-full max-w-[260px] md:max-w-[320px] mx-auto px-3 sm:px-4 overflow-hidden break-words bg-white text-gray-900 p-3 rounded-lg shadow-md border border-dashed border-gray-300 font-mono tracking-tight leading-tight mt-4 mb-8">
          {/* Cabeçalho do cupom */}
          <div className="text-center text-lg font-bold">Reciclagem Perequê</div>
          <div className="text-center text-xs leading-tight my-1">
            <div>Ubatuba, Perequê Mirim</div>
            <div>Av. Marginal, 2504</div>
            <div>12 99162-0321</div>
            <div>CNPJ/PIX 45.492.161/0001-88</div>
          </div>
          <div className="border-b border-gray-400 my-2" />
          <div className="text-center text-sm">
            <div className="font-bold text-base">{header.codigo || '—'}</div>
            <div className="text-sm">{header.comanda_data ? formatDateTime(header.comanda_data) : '—'}</div>
            <div className="uppercase font-bold text-sm">{header.comanda_tipo || '—'}</div>
          </div>

          <div className="border-b border-gray-400 my-2" />

          {/* Itens */}
          {groupedItens.length === 0 ? (
            <div className="text-center text-[13px]">Nenhum item</div>
          ) : (
            <div>
              {/* Cabeçalho de colunas */}
              <div className="grid grid-cols-[2.8fr_1fr_1fr_1.2fr] gap-2 text-xs md:text-sm font-semibold text-gray-700">
                <div>Material</div>
                <div className="text-right">Kg</div>
                <div className="text-right">Preço</div>
                <div className="text-right">Total</div>
              </div>
              <div className="border-b border-dotted border-gray-300 my-1" />
              {/* Linhas de itens (uma linha por material) */}
              {groupedItens.map((g, idx) => (
                <div key={idx} className="grid grid-cols-[2.8fr_1fr_1fr_1.2fr] gap-2 items-center text-sm md:text-base py-2">
                  <div className="pr-1 break-words whitespace-normal leading-normal">{g.nome}</div>
                  <div className="text-right tabular-nums">{formatNumber(g.kg, 2)}</div>
                  <div className="text-right tabular-nums font-semibold">{formatCurrency(g.precoMedio)}</div>
                  <div className="text-right tabular-nums font-semibold">{formatCurrency(g.total)}</div>
                  <div className="col-span-4 border-b border-dotted border-gray-300 my-1" />
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-400 my-2" />

          {/* Totais */}
          <div className="text-center text-base md:text-lg font-semibold text-black">
            TOTAL: {formatCurrency(Number(totalCalculado) || 0)}
          </div>
          {header.observacoes ? (
            <div className="text-center mt-1 text-xs md:text-sm text-gray-600 italic whitespace-pre-wrap">
              {header.observacoes}
            </div>
          ) : null}

          <div className="border-t border-gray-400 my-2" />

          {/* Rodapé do cupom */}
          <div className="text-base font-semibold text-center mt-4 pb-6">Deus seja louvado</div>
            </div>
          </div>
        </div>
      </div>

      {/* === BOTÕES FLUTUANTES FIXOS === */}
      <div className="fixed bottom-4 left-0 w-full flex justify-center z-50">
        <div ref={actionsRef} className="flex justify-center gap-3 w-[95%] max-w-sm bg-background/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-border/30">
          <button className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold text-base shadow-sm active:scale-95">
            WhatsApp
          </button>
          <button className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-semibold text-base shadow-sm active:scale-95">
            PDF
          </button>
          <button className="flex-1 py-3 rounded-lg bg-gray-700 text-white font-semibold text-base shadow-sm active:scale-95">
            Imprimir
          </button>
        </div>
      </div>
      {console.log("✅ Botões renderizados na tela de Imprimir Última Comanda")}
    </div>
  );
};

export default PreviewComanda;


