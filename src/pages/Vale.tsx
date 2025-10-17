import { ArrowLeft, CreditCard, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { insert, addToSyncQueue, selectAll, selectWhere } from "@/database";
import { getSyncStatus } from "@/services/syncEngine";
import { formatCurrency } from "@/utils/formatters";
import { logger } from "@/utils/logger";
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

const Vale = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [vales, setVales] = useState<any[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function loadVales() {
    try {
      const confirmadas = await selectAll<any>('vale_false', 'data DESC');
      const pendentesRows = await selectWhere<any>(
        'sync_queue',
        'synced = ? AND table_name = ? AND operation = ?',
        [0, 'vale_false', 'INSERT'],
        'created_at DESC'
      );

      const pendentes = (pendentesRows || []).map((row: any) => {
        let payload: any = {};
        try {
          const parsed = JSON.parse(row.payload || '{}');
          payload = parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
          // ignore invalid json
        }
        return {
          id: `pending-${row.id}`,
          record_id: row.record_id,
          data: payload.data || row.created_at,
          status: 0,
          nome: payload.nome || '(sem nome)',
          valor: Number(payload.valor) || 0,
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
      setVales(Array.isArray(unificada) ? unificada : []);
    } catch (error) {
      logger.error('Falha ao carregar vales:', error);
      setVales([]);
    }
  }

  useEffect(() => {
    void loadVales();
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
      const novoId = await insert('vale_false', {
        data: now,
        status: 0,
        nome: nome.trim(),
        valor: parseFloat(valor),
        observacao: observacao.trim() || null,
        criado_por: 'local-user',
        atualizado_por: 'local-user',
        origem_offline
      });
      await addToSyncQueue('vale_false', 'INSERT', novoId, {
        id: novoId,
        data: now,
        status: 0,
        nome: nome.trim(),
        valor: parseFloat(valor),
        observacao: observacao.trim() || null,
        criado_por: 'local-user',
        atualizado_por: 'local-user'
      });
      // success toast removed to keep UI silent
      setConfirmOpen(false);
      setNome("");
      setValor("");
      setObservacao("");
      await loadVales();
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  }

  function handleOpenConfirm() {
    if (!nome.trim() || !valor) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha nome e valor', variant: 'destructive' });
      return;
    }
    const valorNum = Number(valor);
    if (!isFinite(valorNum) || valorNum <= 0) {
      toast({ title: 'Informe um valor válido.' });
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Vale</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <CreditCard className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Gestão de Vales</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Input id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleOpenConfirm} disabled={salvando} className="w-full">
            {salvando ? 'Salvando...' : 'Salvar Vale'}
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar registro de vale?</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="mt-2 space-y-1">
                  <div>
                    <span className="font-medium">Nome:</span> {nome || '—'}
                  </div>
                  <div>
                    <span className="font-medium">Valor:</span> {formatCurrency(Number(valor) || 0)}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSalvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="space-y-3">
          {vales.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">Nenhum vale registrado.</Card>
          ) : (
            vales.map((v) => (
              <Card key={v.id} className="p-4 rounded-xl border border-border/20 shadow-sm hover:bg-accent/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-foreground truncate" title={v.nome}>{v.nome}</div>
                    <div className="text-sm text-muted-foreground mt-0.5 truncate">
                      {formatCurrency(Number(v.valor) || 0)} • {v.data ? new Date(v.data).toLocaleString() : ''}
                    </div>
                    {v.observacao ? (
                      <div className="text-sm text-muted-foreground mt-0.5 truncate">{v.observacao}</div>
                    ) : null}
                  </div>
                  {(v.__pending || v.origem_offline === 1) && (
                    <CloudOff className="h-4 w-4 text-yellow-500" title="Pendente de sincronização" />
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default Vale;