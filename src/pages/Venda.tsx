import { ArrowLeft, Plus, Package, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatters";
import { selectAll, addToSyncQueue, insert } from "@/database";
import { getSyncStatus } from "@/services/syncEngine";

const Venda = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [peso, setPeso] = useState("");
  const [precoPersonalizado, setPrecoPersonalizado] = useState("");
  const [desconto, setDesconto] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Calculate subtotal in real-time
  const calcularSubtotal = () => {
    const pesoNum = parseFloat(peso) || 0;
    const descontoKg = parseFloat(desconto) || 0;
    const pesoLiquido = Math.max(0, pesoNum - descontoKg);
    const precoNum = parseFloat(precoPersonalizado) || 0;
    return pesoLiquido * Math.max(0, precoNum);
  };

  const [materiais, setMateriais] = useState<any[]>([]);
  const [loadingMateriais, setLoadingMateriais] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoadingMateriais(true);
        const rows = await selectAll<any>('material', 'nome ASC');
        setMateriais(rows);
      } finally {
        setLoadingMateriais(false);
      }
    }
    void load();
  }, []);

  // Verificar se existe uma comanda de compra em andamento
  useEffect(() => {
    const comandaStorage = localStorage.getItem('comandaAtual');
    if (comandaStorage) {
      const comanda = JSON.parse(comandaStorage);
      if (comanda.tipo === "compra" && comanda.itens.length > 0) {
        toast({
          title: "Atenção",
          description: "Existe uma comanda de compra em andamento. Finalize-a antes de fazer vendas.",
          variant: "destructive"
        });
        // Não redirecionar automaticamente, apenas mostrar o aviso
      }
    }
  }, [toast]);

  const handleMaterialClick = (material: any) => {
    setSelectedMaterial(material);
    setPeso("");
    setPrecoPersonalizado((material.preco_venda || 0).toString());
    setDesconto("");
    setIsDialogOpen(true);
  };

  const handleAdicionar = async () => {
    if (!selectedMaterial || !peso) return;

    const pesoNum = parseFloat(peso) || 0;
    const descontoKg = parseFloat(desconto) || 0;
    const pesoLiquido = Math.max(0, pesoNum - descontoKg);
    const precoNum = parseFloat(precoPersonalizado) || 0;
    const total = pesoLiquido * Math.max(0, precoNum);

    // Registrar em ultimas_20 localmente e enfileirar
    try {
      const status = getSyncStatus();
      const origem_offline = status.hasCredentials && status.isOnline ? 0 : 1;
      const now = new Date().toISOString();
      const novoId = await insert('ultimas_20', {
        data: now,
        material: selectedMaterial.id,
        comanda: null,
        preco_kg: Math.max(0, parseFloat(precoPersonalizado) || 0),
        kg_total: pesoLiquido,
        valor_total: total,
        criado_por: 'local-user',
        atualizado_por: 'local-user',
        origem_offline
      });
      await addToSyncQueue('ultimas_20', 'INSERT', novoId, {
        id: novoId,
        data: now,
        material: selectedMaterial.id,
        comanda: null,
        tipo: 'venda',
        preco_kg: Math.max(0, parseFloat(precoPersonalizado) || 0),
        kg_total: pesoLiquido,
        valor_total: total,
        criado_por: 'local-user',
        atualizado_por: 'local-user'
      });
    } catch {}

    // Criar item para a comanda local (compatibilidade)
    const novoItem = {
      id: Date.now(),
      material: selectedMaterial.nome,
      preco: precoNum,
      quantidade: pesoLiquido,
      total: total
    };

    // Atualizar comanda no localStorage (para manter compatibilidade)
    const comandaStorage = localStorage.getItem('comandaAtual');
    let comanda = { itens: [], tipo: "venda", total: 0 };
    
    if (comandaStorage) {
      comanda = JSON.parse(comandaStorage);
    }
    
    comanda.itens.push(novoItem);
    comanda.tipo = "venda";
    comanda.total = comanda.itens.reduce((acc: any, item: any) => acc + item.total, 0);
    
    localStorage.setItem('comandaAtual', JSON.stringify(comanda));
    
    setIsDialogOpen(false);
    navigate("/comanda-atual");
  };

  const handleCancelar = () => {
    setIsDialogOpen(false);
    setSelectedMaterial(null);
    setPeso("");
    setPrecoPersonalizado("");
    setDesconto("");
  };

  if (loadingMateriais) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando materiais...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
        </div>
      </div>

      {/* Lista de Materiais para Venda */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            Materiais para Venda
          </h2>
        </div>

        {materiais.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum material cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre materiais primeiro para poder vender
            </p>
            <Button onClick={() => navigate('/cadastrar-material')}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Material
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {materiais.map((material, index) => {
              // Cores que mudam a cada 3 materiais
              const colorIndex = Math.floor(index / 3) % 3;
              const colors = [
                { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
                { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
                { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' }
              ];
              const currentColor = colors[colorIndex];
              
              return (
                <Card
                  key={material.id}
                  className={`relative p-3 flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all duration-200 ${currentColor.bg} ${currentColor.border} border-2`}
                  onClick={() => handleMaterialClick(material)}
                >
                  {material.origem_offline === 1 && (
                    <CloudOff className="absolute left-2 top-2 h-4 w-4 text-orange-700" />
                  )}
                  <Package className={`h-6 w-6 ${currentColor.text} mb-2`} />
                  <h3 className="w-full font-semibold text-foreground text-sm leading-snug mb-1 break-words text-center sm:text-base sm:leading-tight">
                    {material.nome}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className={`text-base ${currentColor.text} font-medium`}>
                      {formatCurrency(material.preco_venda)}/kg
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog para adicionar item */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar à Venda</DialogTitle>
          </DialogHeader>
          
          {selectedMaterial && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="material">Material</Label>
                <Input 
                  id="material"
                  value={selectedMaterial.nome}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div>
                <Label htmlFor="peso">Peso (kg)</Label>
                <Input 
                  id="peso"
                  type="number"
                  step="0.01"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  placeholder="Digite o peso"
                />
              </div>
              
              <div>
                <Label htmlFor="preco">Preço por kg</Label>
                <Input 
                  id="preco"
                  type="number"
                  step="0.01"
                  value={precoPersonalizado}
                  onChange={(e) => setPrecoPersonalizado(e.target.value)}
                  placeholder="Digite o preço"
                />
              </div>
              
              <div>
                <Label htmlFor="desconto">Desconto (kg)</Label>
                <Input 
                  id="desconto"
                  type="number"
                  step="0.01"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  placeholder="Digite o desconto"
                />
              </div>
              
              {/* Subtotal Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg text-green-700 font-semibold">Subtotal</p>
                  <p className="text-3xl font-black text-green-800">
                    {formatCurrency(calcularSubtotal())}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancelar}>
                  Cancelar
                </Button>
                <Button onClick={handleAdicionar} disabled={!peso}>
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Venda;