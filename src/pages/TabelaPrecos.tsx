import { ArrowLeft, Search, Edit3, List, Plus, CloudOff, Filter, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatters";
import { selectAll, update as dbUpdate } from "@/database";
import { getSyncStatus } from "@/services/syncEngine";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TabelaPrecos = () => {
  const navigate = useNavigate();
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [novoPrecoVenda, setNovoPrecoVenda] = useState("");
  const [novoPrecoCompra, setNovoPrecoCompra] = useState("");
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Todas");
  const { toast } = useToast();
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [categoriaSearch, setCategoriaSearch] = useState("");
  
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
  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.toLowerCase().includes(categoriaSearch.toLowerCase())),
    [categorias, categoriaSearch]
  );

  const handleEditClick = (material: any) => {
    setSelectedMaterial(material);
    const venda = Number(material.preco_venda);
    const compra = Number(material.preco_compra);
    setNovoPrecoVenda(Number.isFinite(venda) && venda > 0 ? String(venda) : "");
    setNovoPrecoCompra(Number.isFinite(compra) && compra > 0 ? String(compra) : "");
    setIsEditDialogOpen(true);
  };

  useEffect(() => {
    if (selectedMaterial && isEditDialogOpen) {
      const venda = Number(selectedMaterial.preco_venda);
      const compra = Number(selectedMaterial.preco_compra);
      setNovoPrecoVenda(Number.isFinite(venda) && venda > 0 ? String(venda) : "");
      setNovoPrecoCompra(Number.isFinite(compra) && compra > 0 ? String(compra) : "");
    }
  }, [selectedMaterial, isEditDialogOpen]);

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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-accent/20"
            onClick={() => setIsFilterDialogOpen(true)}
            aria-label="Abrir filtro de categorias"
          >
            <Filter className="h-5 w-5 text-primary" />
          </Button>
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

      {/* Filtro por categoria (em popup) */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="rounded-2xl shadow-xl p-4 bg-background max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">Filtrar por Categoria</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Label htmlFor="buscaCategoria" className="text-muted-foreground">Buscar</Label>
            <Input
              id="buscaCategoria"
              placeholder="Digite para filtrar categorias..."
              value={categoriaSearch}
              onChange={(e) => setCategoriaSearch(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="space-y-2 mt-3">
            {categoriasFiltradas.map((cat) => (
              <Button
                key={cat}
                variant={categoriaSelecionada === cat ? "secondary" : "ghost"}
                className="w-full justify-start rounded-lg text-left text-sm sm:text-base"
                onClick={() => {
                  setCategoriaSelecionada(cat);
                  setIsFilterDialogOpen(false);
                }}
              >
                {cat}
                {categoriaSelecionada === cat && <Check className="ml-auto h-4 w-4 text-primary" />}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsFilterDialogOpen(false)} className="w-full mt-3">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de Materiais */}
      {materiaisFiltrados.length === 0 ? (
        <Card className="p-8 text-center rounded-xl shadow-sm">
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
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {materiaisFiltrados.map((material) => (
            <Card key={material.id} className="bg-background shadow-sm rounded-xl p-3 sm:p-4 border border-border/20 hover:bg-accent/5 transition-colors flex flex-col gap-1.5 sm:gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground truncate" title={material.nome}>
                    {material.nome}
                  </h3>
                  {material.origem_offline === 1 && (
                    <CloudOff className="h-4 w-4 text-yellow-500 shrink-0" title="Aguardando sincronização" />
                  )}
                </div>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">{material.categoria}</p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex flex-col leading-tight space-y-0.5">
                  <p className="text-base sm:text-lg font-bold text-primary tabular-nums">
                    {formatCurrency(material.preco_venda || 0)}/kg
                  </p>
                  <p className="text-sm sm:text-base font-medium text-foreground tabular-nums">
                    {formatCurrency(material.preco_compra || 0)}/kg
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-accent/20 min-w-[36px] min-h-[36px]"
                        onClick={() => handleEditClick(material)}
                        aria-label="Editar material"
                      >
                        <Edit3 className="h-5 w-5 text-primary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Editar material</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                <Label htmlFor="precoCompra">Preço de compra</Label>
                <Input 
                  id="precoCompra"
                  type="number"
                  step="0.01"
                  value={novoPrecoCompra}
                  onChange={(e) => setNovoPrecoCompra(e.target.value)}
                  placeholder="Digite o valor"
                />
              </div>
              
              <div>
                <Label htmlFor="precoVenda">Preço de venda</Label>
                <Input 
                  id="precoVenda"
                  type="number"
                  step="0.01"
                  value={novoPrecoVenda}
                  onChange={(e) => setNovoPrecoVenda(e.target.value)}
                  placeholder="Digite o valor"
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