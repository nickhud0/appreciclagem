import { ArrowLeft, Receipt, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { insert, addToSyncQueue, selectAll } from "@/database";
import { getSyncStatus } from "@/services/syncEngine";

const CadastrarDespesa = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    if (!descricao.trim() || !valor) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha descrição e valor', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const status = getSyncStatus();
      const origem_offline = status.hasCredentials && status.isOnline ? 0 : 1;
      const now = new Date().toISOString();
      const novoId = await insert('despesa_mes', {
        data: now,
        descricao: descricao.trim(),
        valor: parseFloat(valor),
        criado_por: 'local-user',
        atualizado_por: 'local-user',
        origem_offline
      });
      await addToSyncQueue('despesa', 'INSERT', novoId, {
        id: novoId,
        data: now,
        descricao: descricao.trim(),
        valor: parseFloat(valor),
        criado_por: 'local-user',
        atualizado_por: 'local-user'
      });
      toast({ title: 'Despesa cadastrada', description: `R$ ${valor} registrada${origem_offline ? ' (offline)' : ''}` });
      navigate('/');
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

          <Button onClick={handleSalvar} disabled={salvando} className="w-full">
            {salvando ? 'Salvando...' : 'Salvar Despesa'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CadastrarDespesa;