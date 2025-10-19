import { ArrowLeft, AlertCircle, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { insert, addToSyncQueue, selectAll, selectWhere, update as dbUpdate } from "@/database";
import { getSyncStatus, triggerSyncNow } from "@/services/syncEngine";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/utils/formatters";

const Pendencias = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<'a_pagar' | 'a_receber'>('a_pagar');
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [isTipoDialogOpen, setIsTipoDialogOpen] = useState(false);
  const [alterandoId, setAlterandoId] = useState<string | number | null>(null);
  const [confirmPagoOpen, setConfirmPagoOpen] = useState(false);
  const [pendenciaParaPagar, setPendenciaParaPagar] = useState<any | null>(null);

  async function loadItems() {
    try {
      const confirmadas = await selectWhere<any>('pendencia_false', 'status = ?', [0], 'data DESC');
      const pendentesRows = await selectWhere<any>('sync_queue', 'synced = ? AND table_name = ? AND operation = ?', [0, 'pendencia_false', 'INSERT'], 'created_at DESC');
      const pendentes = (pendentesRows || []).map((row: any) => {
        let payload: any = {};
        try {
          const parsed = JSON.parse(row.payload || '{}');
          payload = parsed && typeof parsed === 'object' ? parsed : {};
        } catch {}
        return {
          id: `pending-${row.id}`,
          record_id: row.record_id,
          data: payload.data || row.created_at,
          status: 0,
          nome: payload.nome || '(sem nome)',
          valor: Number(payload.valor) || 0,
          tipo: payload.tipo || 'a_pagar',
          observacao: payload.observacao || null,
          __pending: true
        };
      });
      const pendingRecordIds = new Set<string>((pendentes || []).map((p: any) => String(p.record_id || '')));
      const confirmadasSemDuplicatas = (confirmadas || []).filter((c: any) => !pendingRecordIds.has(String(c.id)));
      const unificada = [...pendentes, ...confirmadasSemDuplicatas].sort((a: any, b: any) => {
        const da = a?.data ? new Date(a.data).getTime() : 0;
        const db = b?.data ? new Date(b.data).getTime() : 0;
        return db - da;
      });
      setItems(Array.isArray(unificada) ? unificada : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function handleSalvar() {
    if (!nome.trim() || !valor) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha nome e valor', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const status = getSyncStatus();
      const origem_offline = status.hasCredentials && status.isOnline ? 0 : 1;
      const now = new Date().toISOString();
      const novoId = await insert('pendencia_false', {
        data: now,
        status: 0,
        nome: nome.trim(),
        valor: parseFloat(valor),
        tipo,
        observacao: observacao.trim() || null,
        criado_por: 'local-user',
        atualizado_por: 'local-user',
        origem_offline
      });
      await addToSyncQueue('pendencia_false', 'INSERT', novoId, {
        id: novoId,
        data: now,
        status: 0,
        nome: nome.trim(),
        valor: parseFloat(valor),
        tipo,
        observacao: observacao.trim() || null,
        criado_por: 'local-user',
        atualizado_por: 'local-user'
      });
      if (status.hasCredentials && status.isOnline) {
        triggerSyncNow();
      }
      // success toast removed to keep UI silent
      setNome("");
      setValor("");
      setObservacao("");
      await loadItems();
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  }

  async function handleMarcarComoPago(p: any) {
    try {
      const localId = p?.__pending ? p?.record_id : p?.id;
      if (localId == null || String(localId).trim() === '') {
        toast({ title: 'Não foi possível identificar a pendência.', variant: 'destructive' });
        return;
      }
      setAlterandoId(localId);
      await dbUpdate('pendencia_false', { status: 1, atualizado_por: 'local-user' }, 'id = ?', [localId]);
      await addToSyncQueue('pendencia', 'UPDATE', String(localId), {
        id: Number(localId),
        data: p?.data || new Date().toISOString(),
        status: true,
        nome: p?.nome || '(sem nome)',
        valor: Number(p?.valor) || 0,
        tipo: p?.tipo || 'a_pagar',
        observacao: p?.observacao || null,
        criado_por: 'local-user',
        atualizado_por: 'local-user'
      });
      const statusNow = getSyncStatus();
      if (statusNow.hasCredentials && statusNow.isOnline) {
        triggerSyncNow();
      }
      await loadItems();
    } catch (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    } finally {
      setAlterandoId(null);
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
          <h1 className="text-2xl font-bold text-foreground">Pendências</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-4 sm:p-5 rounded-xl shadow-sm">
        <div className="flex items-center mb-4">
          <AlertCircle className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Registrar Pendência</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Tipo</Label>
            <div className="mt-1">
              <Button
                variant="outline"
                className="w-full justify-between rounded-lg"
                onClick={() => setIsTipoDialogOpen(true)}
              >
                <span className="text-sm sm:text-base">{tipo === 'a_pagar' ? 'A pagar' : 'A receber'}</span>
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Input id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleSalvar} disabled={salvando} className="w-full">
            {salvando ? 'Salvando...' : 'Salvar Pendência'}
          </Button>
        </div>

        <div className="space-y-3">
          {items.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground rounded-xl border border-border/20">Nenhuma pendência registrada.</Card>
          ) : (
            items.map((p) => (
              <Card key={p.id} className="p-3 sm:p-4 rounded-xl border border-border/20 shadow-sm hover:bg-accent/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-semibold text-foreground truncate">{p.nome}</div>
                    <div className="text-sm sm:text-base text-muted-foreground mt-0.5">
                      {formatCurrency(Number(p.valor) || 0)} • {(p.tipo === 'a_pagar' ? 'A pagar' : 'A receber')} • {new Date(p.data).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(p.__pending || p.origem_offline === 1) && (
                      <CloudOff className="h-4 w-4 text-yellow-500" title="Aguardando sincronização" />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setPendenciaParaPagar(p); setConfirmPagoOpen(true); }}
                      disabled={alterandoId === (p?.__pending ? p?.record_id : p?.id)}
                    >
                      Marcar como pago
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        <AlertDialog open={confirmPagoOpen} onOpenChange={setConfirmPagoOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar pagamento desta pendência?</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="mt-2 space-y-1">
                  <div>
                    <span className="font-medium">Nome:</span> {pendenciaParaPagar?.nome || '—'}
                  </div>
                  <div>
                    <span className="font-medium">Valor:</span> {formatCurrency(Number(pendenciaParaPagar?.valor) || 0)}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!alterandoId}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (pendenciaParaPagar) {
                    await handleMarcarComoPago(pendenciaParaPagar);
                  }
                  setConfirmPagoOpen(false);
                  setPendenciaParaPagar(null);
                }}
                disabled={!!alterandoId}
              >
                Confirmar Pagamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      {/* Tipo Selector Dialog */}
      <Dialog open={isTipoDialogOpen} onOpenChange={setIsTipoDialogOpen}>
        <DialogContent className="rounded-2xl shadow-xl p-4 bg-background max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">Selecionar Tipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Button
              variant={tipo === 'a_pagar' ? 'secondary' : 'ghost'}
              className="w-full justify-start rounded-lg text-left text-sm sm:text-base"
              onClick={() => { setTipo('a_pagar'); setIsTipoDialogOpen(false); }}
            >
              A pagar
            </Button>
            <Button
              variant={tipo === 'a_receber' ? 'secondary' : 'ghost'}
              className="w-full justify-start rounded-lg text-left text-sm sm:text-base"
              onClick={() => { setTipo('a_receber'); setIsTipoDialogOpen(false); }}
            >
              A receber
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTipoDialogOpen(false)} className="w-full mt-3">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pendencias;