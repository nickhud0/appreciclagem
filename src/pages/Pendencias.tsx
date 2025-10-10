import { ArrowLeft, AlertCircle, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { insert, addToSyncQueue, selectAll } from "@/database";
import { getSyncStatus } from "@/services/syncEngine";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

  async function loadItems() {
    try {
      const rows = await selectAll<any>('pendencia_false', 'data DESC');
      setItems(rows);
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
      toast({ title: 'Pendência registrada', description: `${nome} - R$ ${valor}${origem_offline ? ' (offline)' : ''}` });
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
                  {p.origem_offline === 1 && (
                    <CloudOff className="h-4 w-4 text-yellow-500" title="Aguardando sincronização" />
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
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