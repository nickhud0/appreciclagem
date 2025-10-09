import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ComandaOfflineFirstExample = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Exemplo Offline-First</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <FileText className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Arquitetura Offline-First</h2>
        </div>

        <div className="space-y-4">
          <p className="text-muted-foreground">
            Esta funcionalidade será implementada quando o backend for adicionado.
          </p>
          
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Funcionalidades Planejadas</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Sincronização automática de dados</li>
              <li>• Cache local inteligente</li>
              <li>• Resolução de conflitos</li>
              <li>• Sincronização em background</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ComandaOfflineFirstExample;