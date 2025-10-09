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

const Pendencias = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<'a_pagar' | 'a_receber'>('a_pagar');
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [items, setItems] = useState<any[]>([]);

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
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <AlertCircle className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Registrar Pendência</h2>
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
            <Label htmlFor="tipo">Tipo</Label>
            <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="w-full mt-1 p-2 border border-input rounded-md bg-background">
              <option value="a_pagar">A pagar</option>
              <option value="a_receber">A receber</option>
            </select>
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
            <Card className="p-6 text-center text-muted-foreground">Nenhuma pendência registrada.</Card>
          ) : (
            items.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">R$ {p.valor} • {p.tipo} • {new Date(p.data).toLocaleString()}</div>
                  </div>
                  {p.origem_offline === 1 && (
                    <span className="inline-flex items-center text-[10px] text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded">
                      <CloudOff className="h-3 w-3 mr-1" /> pendente
                    </span>
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

export default Pendencias;