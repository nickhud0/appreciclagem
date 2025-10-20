import { ArrowLeft, Calculator, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useEffect, useState, useRef } from "react";
import { executeQuery, addToSyncQueue } from "@/database";
import { useToast } from "@/hooks/use-toast";
import { getSyncStatus, triggerSyncNow } from "@/services/syncEngine";
import { getSupabaseClient } from "@/services/supabaseClient";
import { Device } from '@capacitor/device';
import { formatCurrency } from "@/utils/formatters";

const Fechamento = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<{ desde_data: string | null; ate_data: string | null; compra: number | null; despesa: number | null; venda: number | null; lucro: number | null } | null>(null);
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const submittingRef = useRef<boolean>(false);
  function formatDateBullet(value?: string | null) {
    try {
      if (!value) return '—';
      const d = new Date(value);
      const dateStr = d.toLocaleDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} • ${timeStr}`;
    } catch {
      return String(value || '—');
    }
  }

  async function load() {
    try {
      setLoading(true);
      const rows = await executeQuery<any>(`SELECT desde_data, ate_data, compra, despesa, venda, lucro FROM calculo_fechamento ORDER BY rowid DESC LIMIT 1`);
      setData(rows[0] || null);
      const hist = await executeQuery<any>(`SELECT id, data, compra, despesa, venda, lucro, observacao FROM fechamento_mes ORDER BY data DESC`);
      setHistorico(Array.isArray(hist) ? hist : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleFechamento() {
    if (submittingRef.current) return; // bloqueia cliques múltiplos
    const status = getSyncStatus();
    if (!(status.hasCredentials && status.isOnline)) {
      toast({ title: 'Sem conexão', description: 'Conecte-se à nuvem para fechar.', variant: 'destructive' });
      return;
    }
    if (!data) {
      toast({ title: 'Sem dados de fechamento', variant: 'destructive' });
      return;
    }
    submittingRef.current = true;
    setProcessing(true);
    try {
      // Identify device for attribution
      let deviceName = 'Dispositivo Local';
      try {
        const info = await Device.getInfo();
        deviceName = (info as any)?.name || (info as any)?.model || 'Dispositivo Local';
      } catch {}
      // Quando online: envia diretamente para Supabase (public.fechamento)
      const client = getSupabaseClient();
      if (!client) throw new Error('Cliente Supabase não configurado');
      const nowIso = new Date().toISOString();
      const { error } = await client.from('fechamento').insert({
        data: nowIso,
        compra: data.compra,
        despesa: data.despesa,
        venda: data.venda,
        lucro: data.lucro,
        observacao: observacao || null,
        criado_por: deviceName,
        atualizado_por: 'local-user'
      });
      if (error) throw error;
      // success toast removed to keep UI silent
      setObservacao("");
      // Disparar sincronização para atualizar views (calculo_fechamento/fechamento_mes)
      try { triggerSyncNow(); } catch {}
      // Atualizar a view 5 segundos após o envio
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await load();
    } catch (error) {
      toast({ title: 'Erro ao enviar fechamento', variant: 'destructive' });
    } finally {
      setProcessing(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Fechamento</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <Calculator className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Fechamento de Caixa</h2>
        </div>

        <div className="space-y-4">
          {/* Totais - visual modernizado */}
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : data ? (
            <div className="space-y-3">
              {/* Período */}
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm text-muted-foreground">
                <div>Desde: <span className="font-medium text-foreground">{formatDateBullet(data.desde_data)}</span></div>
                <div className="text-right">Até: <span className="font-medium text-foreground">{formatDateBullet(data.ate_data)}</span></div>
              </div>
              {/* Cards financeiros */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 sm:p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <div className="text-xs sm:text-sm text-muted-foreground">Compra</div>
                  <div className="text-xl sm:text-2xl font-bold text-[#eab308]">
                    {data.compra != null ? formatCurrency(Number(data.compra) || 0) : '—'}
                  </div>
                </Card>
                <Card className="p-3 sm:p-4 rounded-xl border border-green-200 bg-green-50">
                  <div className="text-xs sm:text-sm text-muted-foreground">Venda</div>
                  <div className="text-xl sm:text-2xl font-bold text-[#22c55e]">
                    {data.venda != null ? formatCurrency(Number(data.venda) || 0) : '—'}
                  </div>
                </Card>
                <Card className="p-3 sm:p-4 rounded-xl border border-red-200 bg-red-50">
                  <div className="text-xs sm:text-sm text-muted-foreground">Despesa</div>
                  <div className="text-xl sm:text-2xl font-bold text-[#ef4444]">
                    {data.despesa != null ? formatCurrency(Number(data.despesa) || 0) : '—'}
                  </div>
                </Card>
                <Card className="p-3 sm:p-4 rounded-xl border border-muted-foreground/20 bg-card">
                  <div className="text-xs sm:text-sm text-muted-foreground">Lucro</div>
                  <div className={`text-xl sm:text-2xl font-bold ${Number(data.lucro || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.lucro != null ? formatCurrency(Number(data.lucro) || 0) : '—'}
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem dados</div>
          )}

          <div>
            <Label htmlFor="obs">Observação (opcional)</Label>
            <textarea id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="w-full mt-1 p-2 border border-input rounded-md bg-background text-sm min-h-[100px]" placeholder="Digite uma observação" />
          </div>

          <Button onClick={handleFechamento} disabled={processing || !data || !(getSyncStatus().hasCredentials && getSyncStatus().isOnline)} className="w-full">
            <CheckCircle2 className="h-4 w-4 mr-2" /> {processing ? 'Processando...' : 'Realizar Fechamento'}
          </Button>

          {/* Histórico de fechamentos do mês (SQLite fechamento_mes) */}
          <div className="mt-2 space-y-3">
            {loading ? (
              <div className="text-center text-muted-foreground">Carregando histórico...</div>
            ) : historico.length === 0 ? (
              <Card className="p-4 text-center text-muted-foreground bg-muted/30 border border-border/20 rounded-xl">Nenhum fechamento registrado.</Card>
            ) : (
              historico.map((f: any) => (
                <Card key={f.id ?? `${f.data}-${Math.random()}`} className="p-4 rounded-xl border border-border/20 shadow-sm bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm text-muted-foreground">{f.data ? new Date(f.data).toLocaleString() : '—'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>Compra: <span className="font-semibold text-[#eab308]">{formatCurrency(Number(f.compra) || 0)}</span></div>
                    <div>Venda: <span className="font-semibold text-[#22c55e]">{formatCurrency(Number(f.venda) || 0)}</span></div>
                    <div>Despesa: <span className="font-semibold text-[#ef4444]">{formatCurrency(Number(f.despesa) || 0)}</span></div>
                    <div>Lucro: <span className={`font-semibold ${Number(f.lucro || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Number(f.lucro) || 0)}</span></div>
                  </div>
                  {f.observacao && (
                    <div className="mt-2 text-xs text-muted-foreground">Obs: {f.observacao}</div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Fechamento;