import { ArrowLeft, FileText, Plus, Trash2, Edit, Calculator, ShoppingCart, DollarSign } from "lucide-react";
import { Device } from '@capacitor/device';
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatters";
import { insert, addToSyncQueue } from "@/database";
import { getSyncStatus, triggerSyncNow } from "@/services/syncEngine";
import { getComandaPrefix, nextComandaSequence, buildComandaCodigo } from "@/services/settings";

interface ComandaItem {
  id: number;
  material: string;
  preco: number;
  quantidade: number;
  total: number;
}

interface Comanda {
  itens: ComandaItem[];
  tipo: 'compra' | 'venda';
  total: number;
}

const ComandaAtual = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [materiais, setMateriais] = useState<any[]>([]);
  
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ComandaItem | null>(null);
  const [editQuantidade, setEditQuantidade] = useState("");
  const [editPreco, setEditPreco] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [novaQuantidade, setNovaQuantidade] = useState("");
  const [novoPreco, setNovoPreco] = useState("");

  // Calculate subtotal in real-time for edit dialog
  const calcularSubtotalEdit = () => {
    const quantidade = parseFloat(editQuantidade) || 0;
    const preco = parseFloat(editPreco) || 0;
    return quantidade * preco;
  };

  useEffect(() => {
    const comandaStorage = localStorage.getItem('comandaAtual');
    if (comandaStorage) {
      setComanda(JSON.parse(comandaStorage));
    }
  }, []);

  const updateComanda = (novaComanda: Comanda) => {
    setComanda(novaComanda);
    localStorage.setItem('comandaAtual', JSON.stringify(novaComanda));
  };

  const handleEditItem = (item: ComandaItem) => {
    setSelectedItem(item);
    setEditQuantidade(item.quantidade.toString());
    setEditPreco(item.preco.toString());
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedItem || !comanda) return;

    const novaQuantidade = parseFloat(editQuantidade) || 0;
    const novoPreco = parseFloat(editPreco) || 0;
    const novoTotal = novaQuantidade * novoPreco;

    const novaComanda = {
      ...comanda,
      itens: comanda.itens.map(item => 
        item.id === selectedItem.id 
          ? { ...item, quantidade: novaQuantidade, preco: novoPreco, total: novoTotal }
          : item
      )
    };
    novaComanda.total = novaComanda.itens.reduce((acc, item) => acc + item.total, 0);

    updateComanda(novaComanda);
    setIsEditDialogOpen(false);
    setSelectedItem(null);
    // success toast removed to keep UI silent
  };

  const handleDeleteItem = (itemId: number) => {
    if (!comanda) return;

    const novaComanda = {
      ...comanda,
      itens: comanda.itens.filter(item => item.id !== itemId)
    };
    novaComanda.total = novaComanda.itens.reduce((acc, item) => acc + item.total, 0);

    updateComanda(novaComanda);
    // success toast removed to keep UI silent
  };

  const handleAddItem = () => {
    if (!selectedMaterial || !comanda) return;

    const quantidade = parseFloat(novaQuantidade) || 0;
    const preco = parseFloat(novoPreco) || 0;
    const total = quantidade * preco;

    const novoItem: ComandaItem = {
      id: Date.now(),
      material: selectedMaterial.nome,
      preco: preco,
      quantidade: quantidade,
      total: total
    };

    const novaComanda = {
      ...comanda,
      itens: [...comanda.itens, novoItem]
    };
    novaComanda.total = novaComanda.itens.reduce((acc, item) => acc + item.total, 0);

    updateComanda(novaComanda);
    setIsAddDialogOpen(false);
    setSelectedMaterial(null);
    setNovaQuantidade("");
    setNovoPreco("");
    // success toast removed to keep UI silent
  };

  const handleLimparComanda = () => {
    setComanda(null);
    localStorage.removeItem('comandaAtual');
    // success toast removed to keep UI silent
  };

  // Agrupar itens visualmente por material com preço médio ponderado
  const groupedItens = useMemo(() => {
    if (!comanda || !Array.isArray(comanda.itens)) return [] as Array<{ material: string; kg_total: number; valor_total: number; preco_medio: number; ids: number[] }>;
    const map = new Map<string, { kg: number; total: number; ids: number[] }>();
    for (const it of comanda.itens) {
      const key = it.material || '—';
      const prev = map.get(key) || { kg: 0, total: 0, ids: [] as number[] };
      prev.kg += Number(it.quantidade) || 0;
      prev.total += Number(it.total) || 0;
      prev.ids.push(it.id);
      map.set(key, prev);
    }
    const result: Array<{ material: string; kg_total: number; valor_total: number; preco_medio: number; ids: number[] }> = [];
    for (const [material, v] of map.entries()) {
      const kg = v.kg;
      const total = v.total;
      const precoMedio = kg > 0 ? Number((total / kg).toFixed(2)) : 0;
      result.push({ material, kg_total: kg, valor_total: total, preco_medio: precoMedio, ids: v.ids });
    }
    return result;
  }, [comanda]);

  const handleFinalizarComanda = async () => {
    if (!comanda || comanda.itens.length === 0) return;

    try {
      const status = getSyncStatus();
      const origem_offline = status.hasCredentials && status.isOnline ? 0 : 1;
      const now = new Date().toISOString();
      // Identify the device for attribution
      let deviceName = 'Dispositivo Local';
      try {
        const info = await Device.getInfo();
        deviceName = (info as any)?.name || (info as any)?.model || 'Dispositivo Local';
      } catch {}
      // Create a local synthetic comanda id and codigo to correlate pending inserts in Historico
      const localComandaId = Date.now();
      // Build codigo using saved prefix and per-prefix sequence
      const prefix = getComandaPrefix();
      const sequence = nextComandaSequence(prefix);
      const codigo = `${prefix || ''}${sequence}`;

      // Enqueue the comanda itself with its tipo so Historico can show "Tipo: Compra/Venda"
      try {
        await addToSyncQueue('comanda', 'INSERT', String(localComandaId), {
          // optional id omitted to allow server to assign; record_id links pending view
          data: now,
          codigo,
          tipo: comanda.tipo,
          observacoes: null,
          total: comanda.total,
          criado_por: deviceName,
          atualizado_por: 'local-user'
        });
        // removed verification log to keep console silent
      } catch {}

      // Enfileirar cada item diretamente na tabela 'item' usando codigo como vínculo
      for (const it of comanda.itens) {
        try {
          await addToSyncQueue('item', 'INSERT', '', {
            data: now,
            codigo, // chave de ligação entre comanda e itens
            // material id pode não estar disponível offline; incluir fallbacks
            material: null,
            material_nome: it.material,
            categoria: null,
            preco_kg: it.preco,
            kg_total: it.quantidade,
            valor_total: it.total,
            criado_por: deviceName,
            atualizado_por: 'local-user'
          });
        } catch {}
      }

      // Disparar sincronização silenciosa se online e com credenciais
      try {
        if (status.hasCredentials && status.isOnline) {
          triggerSyncNow();
        }
      } catch {}

      // success toast removed to keep UI silent

      handleLimparComanda();
      navigate('/');
    } catch (error) {
      toast({ title: 'Erro ao finalizar comanda', variant: 'destructive' });
    }
  };

  if (!comanda || comanda.itens.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-3 z-10">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" className="mr-2" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Comanda Atual</h1>
          </div>
        </div>

        {/* Conteúdo vazio */}
        <div className="p-3">
          <Card className="p-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Nenhuma comanda ativa</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Adicione itens nas páginas de compra ou venda para começar uma comanda.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/compra')} className="w-full">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Nova Compra
              </Button>
              <Button variant="outline" onClick={() => navigate('/venda')} className="w-full">
                <DollarSign className="h-4 w-4 mr-2" />
                Nova Venda
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Responsivo */}
      <div className="sticky top-0 bg-background border-b p-3 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" className="mr-2" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Comanda Atual</h1>
          </div>
        </div>
        
        {/* Botões de ação - Responsivos */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(comanda.tipo === "compra" ? "/compra" : "/venda")}
            className="flex-1"
          >
            Adicionar
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLimparComanda}
            className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 border-red-300 hover:border-red-400"
          >
            Cancelar
          </Button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-3 pb-24">
        {/* Tipo da Comanda */}
        <Card className="p-4 mb-4 bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {comanda.tipo === 'compra' ? (
                <ShoppingCart className="h-5 w-5 text-primary" />
              ) : (
                <DollarSign className="h-5 w-5 text-green-600" />
              )}
              <span className="text-base font-semibold text-foreground">
                Comanda de {comanda.tipo === 'compra' ? 'Compra' : 'Venda'}
              </span>
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {comanda.itens.length} item{comanda.itens.length !== 1 ? 's' : ''}
            </span>
          </div>
        </Card>

        {/* Lista de Itens Agrupados - Responsiva */}
        <div className="space-y-4 mb-6">
          {groupedItens.map((g) => (
            <Card key={g.material} className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-foreground text-base leading-tight flex-1 pr-3">
                    {g.material}
                  </h3>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{g.ids.length} item{g.ids.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground text-xs block">Kg total</span>
                    <span className="font-semibold text-base">{g.kg_total}kg</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground text-xs block">Preço/kg médio</span>
                    <span className="font-semibold text-base">{formatCurrency(g.preco_medio)}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground text-xs block">Total</span>
                    <span className="font-bold text-base text-primary">{formatCurrency(g.valor_total)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Total da Comanda */}
        <Card className="p-4 bg-primary/10 border-2 border-primary/20 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-foreground">Total da Comanda:</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(comanda.total)}
            </span>
          </div>
        </Card>
      </div>

      {/* Botão Finalizar - Fixo na parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-primary/20 p-4 z-20">
        <Button 
          onClick={handleFinalizarComanda} 
          className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold text-base"
          size="lg"
        >
          <Calculator className="h-6 w-6 mr-3" />
          Finalizar Comanda
        </Button>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Editar Item</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="material">Material</Label>
                <Input 
                  id="material"
                  value={selectedItem.material}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div>
                <Label htmlFor="quantidade">Quantidade (kg)</Label>
                <Input 
                  id="quantidade"
                  type="number"
                  step="0.01"
                  value={editQuantidade}
                  onChange={(e) => setEditQuantidade(e.target.value)}
                  placeholder="Digite a quantidade"
                />
              </div>
              
              <div>
                <Label htmlFor="preco">Preço por kg</Label>
                <Input 
                  id="preco"
                  type="number"
                  step="0.01"
                  value={editPreco}
                  onChange={(e) => setEditPreco(e.target.value)}
                  placeholder="Digite o preço"
                />
              </div>
              
              {/* Subtotal Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg text-green-700 font-semibold">Subtotal</p>
                  <p className="text-3xl font-black text-green-800">
                    {formatCurrency(calcularSubtotalEdit())}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button onClick={handleSaveEdit} className="w-full">
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Adicionar Item */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Adicionar Item</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="materialSelect">Material</Label>
              <select
                id="materialSelect"
                value={selectedMaterial?.id || ""}
                onChange={(e) => {
                  const material = materiais.find(m => m.id === parseInt(e.target.value));
                  setSelectedMaterial(material);
                  if (material) {
                    setNovoPreco(comanda.tipo === 'compra' ? material.preco_compra_kg.toString() : material.preco_venda_kg.toString());
                  }
                }}
                className="w-full mt-1 p-3 border border-input rounded-md bg-background text-sm"
              >
                <option value="">Selecione um material</option>
                {materiais.map(material => (
                  <option key={material.id} value={material.id}>
                    {material.nome}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <Label htmlFor="novaQuantidade">Quantidade (kg)</Label>
              <Input 
                id="novaQuantidade"
                type="number"
                step="0.01"
                value={novaQuantidade}
                onChange={(e) => setNovaQuantidade(e.target.value)}
                placeholder="Digite a quantidade"
                className="p-3"
              />
            </div>
            
            <div>
              <Label htmlFor="novoPreco">Preço por kg</Label>
              <Input 
                id="novoPreco"
                type="number"
                step="0.01"
                value={novoPreco}
                onChange={(e) => setNovoPreco(e.target.value)}
                placeholder="Digite o preço"
                className="p-3"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleAddItem} 
                disabled={!selectedMaterial || !novaQuantidade}
                className="w-full"
              >
                Adicionar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)} 
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComandaAtual;