import { ArrowLeft, Calculator, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { executeQuery, addToSyncQueue } from "@/database";
import { useToast } from "@/hooks/use-toast";
import { getSyncStatus } from "@/services/syncEngine";
import { Device } from '@capacitor/device';

const Fechamento = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<{ desde_data: string | null; ate_data: string | null; compra: number | null; despesa: number | null; venda: number | null; lucro: number | null } | null>(null);
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const rows = await executeQuery<any>(`SELECT desde_data, ate_data, compra, despesa, venda, lucro FROM calculo_fechamento ORDER BY rowid DESC LIMIT 1`);
      setData(rows[0] || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleFechamento() {
    const status = getSyncStatus();
    if (!(status.hasCredentials && status.isOnline)) {
      toast({ title: 'Sem conexão', description: 'Conecte-se à nuvem para fechar.', variant: 'destructive' });
      return;
    }
    if (!data) {
      toast({ title: 'Sem dados de fechamento', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      // Identify device for attribution
      let deviceName = 'Dispositivo Local';
      try {
        const info = await Device.getInfo();
        deviceName = (info as any)?.name || (info as any)?.model || 'Dispositivo Local';
      } catch {}
      const payload = {
        desde_data: data.desde_data,
        ate_data: data.ate_data,
        compra: data.compra,
        despesa: data.despesa,
        venda: data.venda,
        lucro: data.lucro,
        observacao: observacao || null,
        criado_por: deviceName,
        atualizado_por: 'local-user'
      };
      const syntheticId = `fech_${Date.now()}`;
      await addToSyncQueue('fechamento', 'INSERT', syntheticId, payload);
      // success toast removed to keep UI silent
      setObservacao("");
    } catch (error) {
      toast({ title: 'Erro ao enviar fechamento', variant: 'destructive' });
    } finally {
      setProcessing(false);
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Carregando...' : data ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>Desde: <span className="font-medium text-foreground">{data.desde_data || '—'}</span></div>
                  <div>Até: <span className="font-medium text-foreground">{data.ate_data || '—'}</span></div>
                  <div>Compra: <span className="font-medium text-foreground">{data.compra ?? '—'}</span></div>
                  <div>Despesa: <span className="font-medium text-foreground">{data.despesa ?? '—'}</span></div>
                  <div>Venda: <span className="font-medium text-foreground">{data.venda ?? '—'}</span></div>
                  <div>Lucro: <span className="font-medium text-foreground">{data.lucro ?? '—'}</span></div>
                </div>
              ) : 'Sem dados' }
            </div>
            <Button variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
          </div>

          <div>
            <Label htmlFor="obs">Observação (opcional)</Label>
            <textarea id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="w-full mt-1 p-2 border border-input rounded-md bg-background text-sm min-h-[100px]" placeholder="Digite uma observação" />
          </div>

          <Button onClick={handleFechamento} disabled={processing || !data} className="w-full">
            <CheckCircle2 className="h-4 w-4 mr-2" /> {processing ? 'Processando...' : 'Realizar Fechamento'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Fechamento;