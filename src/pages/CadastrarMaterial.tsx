import { ArrowLeft, Save, Package, CloudOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { insert, executeQuery, addToSyncQueue } from "@/database";
import { getSyncStatus } from "@/services/syncEngine";

const CadastrarMaterial = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    preco_compra_kg: "",
    preco_venda_kg: "",
    categoria: "",
    novaCategoria: ""
  });
  const [loading, setLoading] = useState(false);

  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    async function loadCategorias() {
      try {
        const rows = await executeQuery<{ categoria: string }>(
          `SELECT DISTINCT categoria FROM material WHERE categoria IS NOT NULL AND categoria <> '' ORDER BY categoria`
        );
        setCategorias(rows.map(r => r.categoria));
      } catch {
        setCategorias([]);
      }
    }
    void loadCategorias();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim() || !formData.preco_compra_kg || !formData.preco_venda_kg) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, preço de compra e preço de venda são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const categoriaFinal = formData.novaCategoria.trim() || formData.categoria || "Outros";
      
      const now = new Date().toISOString();
      // Always mark as offline-origin until successful sync confirms it
      const origem_offline = 1;

      const dataToInsert = {
        data: now,
        nome: formData.nome.trim(),
        categoria: categoriaFinal,
        preco_compra: parseFloat(formData.preco_compra_kg),
        preco_venda: parseFloat(formData.preco_venda_kg),
        criado_por: 'local-user',
        atualizado_por: 'local-user',
        origem_offline
      } as any;

      const newId = await insert('material', dataToInsert);

      await addToSyncQueue('material', 'INSERT', newId, { id: newId, ...dataToInsert });
      
      // success toast removed to keep UI silent
      navigate("/");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar material",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Cadastrar Material</h1>
        </div>
      </div>


      {/* Formulário */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <Package className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Novo Material</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome do Material *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do material"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="preco-compra">Preço Compra/Kg (R$) *</Label>
              <Input
                id="preco-compra"
                type="number"
                step="0.01"
                min="0"
                value={formData.preco_compra_kg}
                onChange={(e) => setFormData(prev => ({ ...prev, preco_compra_kg: e.target.value }))}
                placeholder="0.00"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="preco-venda">Preço Venda/Kg (R$) *</Label>
              <Input
                id="preco-venda"
                type="number"
                step="0.01"
                min="0"
                value={formData.preco_venda_kg}
                onChange={(e) => setFormData(prev => ({ ...prev, preco_venda_kg: e.target.value }))}
                placeholder="0.00"
                className="mt-1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value, novaCategoria: "" }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="nova-categoria">Ou criar nova categoria</Label>
              <Input
                id="nova-categoria"
                value={formData.novaCategoria}
                onChange={(e) => setFormData(prev => ({ ...prev, novaCategoria: e.target.value, categoria: "" }))}
                placeholder="Nome da nova categoria"
                className="mt-1"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Salvando..." : "Salvar Material"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default CadastrarMaterial;