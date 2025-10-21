import { 
  ShoppingCart, 
  DollarSign, 
  FileText, 
  History, 
  Calculator, 
  BarChart3, 
  Clock, 
  List, 
  Package, 
  Plus, 
  Receipt, 
  CreditCard, 
  AlertCircle, 
  Settings,
  Printer
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "COMPRA", path: "/compra", icon: ShoppingCart, color: "text-primary" },
  { title: "VENDA", path: "/venda", icon: DollarSign, color: "text-green-600" },
  { title: "Comanda Atual", path: "/comanda-atual", icon: FileText, color: "text-blue-600" },
  { title: "Histórico de Comandas", path: "/historico-comandas", icon: History, color: "text-muted-foreground" },
  { title: "Fechamento", path: "/fechamento", icon: Calculator, color: "text-primary" },
  { title: "Relatórios", path: "/relatorios", icon: BarChart3, color: "text-muted-foreground" },
  { title: "Últimos", path: "/ultimos", icon: Clock, color: "text-blue-600" },
  { title: "Tabela de Preços", path: "/tabela-precos", icon: List, color: "text-muted-foreground" },
  { title: "Estoque", path: "/estoque", icon: Package, color: "text-primary" },
  { title: "Cadastrar Material", path: "/cadastrar-material", icon: Plus, color: "text-green-600" },
  { title: "Cadastrar Despesa", path: "/cadastrar-despesa", icon: Receipt, color: "text-orange-600" },
  { title: "Vale", path: "/vale", icon: CreditCard, color: "text-blue-600" },
  { title: "Pendências", path: "/pendencias", icon: AlertCircle, color: "text-orange-600" },
  { title: "Configurações", path: "/configuracoes", icon: Settings, color: "text-muted-foreground" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Reciclagem Pereque
            </h1>
            <p className="text-muted-foreground">
              Gestão completa do seu depósito
            </p>
          </div>
        </div>
      </div>

      {/* Botão Principal - Imprimir Última Comanda (abre Preview) */}
      <Card className="mb-6 p-4 bg-gradient-to-r from-success to-success/80 border-0 shadow-lg">
        <Link to="/preview-comanda">
          <Button 
            variant="ghost" 
            className="w-full h-16 text-success-foreground hover:bg-white/10"
            size="lg"
          >
            <Printer className="mr-3 h-6 w-6" />
            <span className="text-lg font-semibold">Imprimir Última Comanda</span>
          </Button>
        </Link>
      </Card>

      {/* Grid de Menu */}
      <div className="grid grid-cols-2 gap-4">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Link key={item.path} to={item.path}>
              <Card className="h-24 bg-gradient-to-br from-card to-card/50">
                <div className="flex flex-col items-center justify-center h-full p-4">
                  <IconComponent 
                    className={`h-6 w-6 mb-2 ${item.color}`} 
                  />
                  <span className="text-sm font-medium text-center text-card-foreground leading-tight">
                    {item.title}
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

    </div>
  );
};

export default Index;