import { ArrowLeft, Search, Edit, List, Plus, CloudOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatters";
import { selectAll, update as dbUpdate } from "@/database";
import { getSyncStatus } from "@/services/syncEngine";

const TabelaPrecos = () => {
  const navigate = useNavigate();
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [novoPrecoVenda, setNovoPrecoVenda] = useState("");
  const [novoPrecoCompra, setNovoPrecoCompra] = useState("");
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Todas");
  const { toast } = useToast();
  
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadMateriais() {
    try {
      setLoading(true);
      const rows = await selectAll<any>('material', 'nome ASC');
      setMateriais(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMateriais();
  }, []);

  // Filtrar materiais por busca e categoria
  const materiaisFiltrados = materiais.filter(material => {
    const matchBusca = material.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoriaSelecionada === "Todas" || material.categoria === categoriaSelecionada;
    return matchBusca && matchCategoria;
  });

  // Obter categorias únicas
  const categorias = ["Todas", ...Array.from(new Set(materiais.map(m => m.categoria || "Outros")))];

  const handleEditClick = (material: any) => {
    setSelectedMaterial(material);
    setNovoPrecoVenda(material.preco_venda_kg?.toString() || "0");
    setNovoPrecoCompra(material.preco_compra_kg?.toString() || "0");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMaterial) return;

    const novoPrecoVendaNum = parseFloat(novoPrecoVenda) || 0;
    const novoPrecoCompraNum = parseFloat(novoPrecoCompra) || 0;

    if (novoPrecoVendaNum <= 0 || novoPrecoCompraNum <= 0) {
      toast({
        title: "Preços inválidos",
        description: "Os preços devem ser maiores que zero",
        variant: "destructive"
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const status = getSyncStatus();
      const origem_offline = status.hasCredentials && status.isOnline ? 0 : 1;

      await dbUpdate('material', {
        preco_compra: novoPrecoCompraNum,
        preco_venda: novoPrecoVendaNum,
        atualizado_por: 'local-user',
        origem_offline,
        data_sync: origem_offline ? null : now
      }, 'id = ?', [selectedMaterial.id]);

      await loadMateriais();

      toast({
        title: "Preços atualizados",
        description: `Preços do ${selectedMaterial.nome} atualizados com sucesso`
      });
      setIsEditDialogOpen(false);
      setSelectedMaterial(null);
    } catch (error) {
      console.error('Error updating material prices:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Erro ao atualizar preços do material",
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setSelectedMaterial(null);
    setNovoPrecoVenda("");
    setNovoPrecoCompra("");
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold text-foreground">Tabela de Preços</h1>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar materiais..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Label htmlFor="categoria">Categoria</Label>
          <select
            id="categoria"
            value={categoriaSelecionada}
            onChange={(e) => setCategoriaSelecionada(e.target.value)}
            className="w-full mt-1 p-2 border border-input rounded-md bg-background"
          >
            {categorias.map(categoria => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Materiais */}
      {materiaisFiltrados.length === 0 ? (
        <Card className="p-8 text-center">
          <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum material encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {materiais.length === 0 
              ? "Cadastre materiais primeiro para visualizar na tabela de preços"
              : "Nenhum material corresponde aos filtros aplicados"
            }
          </p>
          {materiais.length === 0 && (
            <Button onClick={() => navigate('/cadastrar-material')}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Material
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {materiaisFiltrados.map((material) => (
            <Card key={material.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-foreground">{material.nome}</h3>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {material.categoria}
                    </span>
                    {material.origem_offline === 1 && (
                      <span className="inline-flex items-center text-[10px] text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded">
                        <CloudOff className="h-3 w-3 mr-1" /> pendente
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Compra:</span>
                      <span className="ml-2 font-medium">{formatCurrency(material.preco_compra)}/kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Venda:</span>
                      <span className="ml-2 font-medium text-green-600">{formatCurrency(material.preco_venda)}/kg</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClick(material)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Preços</DialogTitle>
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
                <Label htmlFor="precoCompra">Preço de Compra (R$/kg)</Label>
                <Input 
                  id="precoCompra"
                  type="number"
                  step="0.01"
                  value={novoPrecoCompra}
                  onChange={(e) => setNovoPrecoCompra(e.target.value)}
                  placeholder="Digite o preço de compra"
                />
              </div>
              
              <div>
                <Label htmlFor="precoVenda">Preço de Venda (R$/kg)</Label>
                <Input 
                  id="precoVenda"
                  type="number"
                  step="0.01"
                  value={novoPrecoVenda}
                  onChange={(e) => setNovoPrecoVenda(e.target.value)}
                  placeholder="Digite o preço de venda"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TabelaPrecos;