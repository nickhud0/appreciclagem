import { ArrowLeft, Receipt, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { addToSyncQueue, selectAll, selectWhere } from "@/database";
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

const CadastrarDespesa = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSalvar() {
    if (!descricao.trim() || !valor) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha descrição e valor', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const now = new Date().toISOString();
      // Sempre fila offline para evitar duplicação local/confirmada
      const payload = {
        data: now,
        descricao: descricao.trim(),
        valor: parseFloat(valor),
        criado_por: 'local-user',
        atualizado_por: 'local-user',
        origem_offline: 1
      } as any;

      // record_id vazio para não tentar atualizar item local inexistente
      await addToSyncQueue('despesa', 'INSERT', '', payload);

      toast({ title: 'Despesa cadastrada', description: `R$ ${valor} registrada (offline)` });
      // UX: permanecer na página para cadastrar múltiplas despesas
      setConfirmOpen(false);
      setDescricao("");
      setValor("");
      // Atualiza a lista para exibir o item pendente recém adicionado
      void loadLista();
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  }

  function handleOpenConfirm() {
    // Validações antes de abrir confirmação
    if (!descricao.trim() || !valor) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha descrição e valor', variant: 'destructive' });
      return;
    }
    const valorNumber = Number(valor);
    if (!isFinite(valorNumber) || valorNumber <= 0) {
      toast({ title: 'Informe um valor válido.' });
      return;
    }
    setConfirmOpen(true);
  }

  async function loadLista() {
    try {
      setCarregandoLista(true);
      const confirmadas = await selectAll<any>('despesa_mes', 'data DESC');
      const pendentesRows = await selectWhere<any>(
        'sync_queue',
        'synced = ? AND table_name = ? AND operation = ?',
        [0, 'despesa', 'INSERT'],
        'created_at DESC'
      );
      const pendentes = (pendentesRows || []).map((row: any) => {
        let payload: any = {};
        try {
          const parsed = JSON.parse(row.payload || '{}');
          payload = parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
          // invalid JSON: keep empty payload
        }
        return {
          id: `pending-${row.id}`,
          data: payload.data || row.created_at,
          descricao: payload.descricao || '(sem descrição)',
          valor: Number(payload.valor) || 0,
          __pending: true
        };
      });
      const unificada = [...pendentes, ...(confirmadas || [])].sort((a: any, b: any) => {
        const da = a?.data ? new Date(a.data).getTime() : 0;
        const db = b?.data ? new Date(b.data).getTime() : 0;
        return db - da;
      });
      setLista(Array.isArray(unificada) ? unificada : []);
    } catch (error) {
      logger.error('Falha ao carregar despesas:', error);
      setLista([]);
    } finally {
      setCarregandoLista(false);
    }
  }

  // Carregar lista ao abrir
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadLista(); }, []);

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Cadastrar Despesa</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <Receipt className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Nova Despesa</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1" />
          </div>

          <Button onClick={handleOpenConfirm} disabled={salvando} className="w-full">
            {salvando ? 'Salvando...' : 'Salvar Despesa'}
          </Button>
        </div>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar lançamento da despesa?</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="mt-2 space-y-1">
                  <div>
                    <span className="font-medium">Descrição:</span> {descricao || '—'}
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
        <div className="mt-6 space-y-3">
          {carregandoLista ? (
            <Card className="p-6 text-center text-muted-foreground">Carregando despesas...</Card>
          ) : lista.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">Nenhuma despesa registrada.</Card>
          ) : (
            lista.map((d: any) => (
              <Card key={d.id ?? `${d.descricao}-${d.data}`} className="p-4 rounded-xl border border-border/20 shadow-sm hover:bg-accent/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-base sm:text-lg font-semibold text-foreground truncate" title={d.descricao}>{d.descricao}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {formatCurrency(Number(d.valor) || 0)} • {d.data ? new Date(d.data).toLocaleString() : ''}
                    </div>
                  </div>
                  {d.__pending && (
                    <CloudOff className="h-4 w-4 text-yellow-500" title="Aguardando sincronização" />
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

export default CadastrarDespesa;