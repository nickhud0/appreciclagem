/**
 * Componentes padronizados de loading e estados vazios
 */

import { Loader2, AlertCircle, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Loading spinner centralizado
 */
export function LoadingSpinner({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Estado de erro padrão
 */
export function ErrorState({ 
  message = "Não foi possível carregar os dados", 
  onRetry,
  showRetry = true 
}: { 
  message?: string; 
  onRetry?: () => void;
  showRetry?: boolean;
}) {
  return (
    <Alert variant="destructive" className="mx-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {showRetry && onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Estado vazio padrão
 */
export function EmptyState({ 
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="p-8 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}

/**
 * Indicador de status offline
 */
export function OfflineBanner({ lastUpdate }: { lastUpdate?: string }) {
  return (
    <Card className="mb-4 p-3 bg-warning/10 border-warning/20">
      <div className="flex items-center gap-2 text-sm text-warning-foreground">
        <WifiOff className="h-4 w-4" />
        <span>
          📡 Offline{lastUpdate ? ` — dados de ${lastUpdate}` : ""}
        </span>
      </div>
    </Card>
  );
}

/**
 * Indicador de sincronização
 */
export function SyncIndicator({ 
  isOnline, 
  pendingCount = 0, 
  onSync,
  syncing = false 
}: { 
  isOnline: boolean;
  pendingCount?: number;
  onSync?: () => void;
  syncing?: boolean;
}) {
  if (!isOnline && pendingCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {!isOnline && (
        <div className="flex items-center gap-1 text-xs text-warning">
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </div>
      )}
      
      {pendingCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-info">
          <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
          <span>{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
        </div>
      )}
      
      {isOnline && pendingCount > 0 && onSync && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onSync}
          disabled={syncing}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </Button>
      )}
    </div>
  );
}

/**
 * Card de resumo com loading
 */
export function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  loading = false,
  variant = "default"
}: {
  title: string;
  value: string | number;
  subtitle: string;
  loading?: boolean;
  variant?: "default" | "success" | "warning" | "destructive" | "accent" | "primary";
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case "success": return "text-success";
      case "warning": return "text-warning";
      case "destructive": return "text-destructive";
      case "accent": return "text-accent";
      case "primary": return "text-primary";
      default: return "text-foreground";
    }
  };

  return (
    <div className="text-center">
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 w-16 bg-muted rounded mx-auto mb-2" />
          <div className="h-4 w-20 bg-muted rounded mx-auto" />
        </div>
      ) : (
        <>
          <p className={`text-2xl font-bold ${getVariantClasses()}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </>
      )}
    </div>
  );
}

/**
 * Wrapper padrão para páginas com loading/error
 */
export function PageWrapper({ 
  loading, 
  error, 
  onRetry, 
  children,
  loadingMessage = "Carregando dados..."
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingMessage?: string;
}) {
  if (loading) {
    return <LoadingSpinner message={loadingMessage} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return <>{children}</>;
}