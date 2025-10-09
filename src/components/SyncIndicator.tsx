import { useEffect, useMemo, useRef, useState } from 'react';
import { onSyncStatus, type SyncStatus } from '@/services/syncEngine';
import { toast } from '@/hooks/use-toast';
import { Cloud, CloudOff, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: false,
    hasCredentials: false,
    syncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    lastError: null
  });
  const prev = useRef<SyncStatus | null>(null);

  useEffect(() => {
    const off = onSyncStatus((s) => setStatus(s));
    return () => off();
  }, []);

  useEffect(() => {
    const p = prev.current;
    // Sync start
    if (p && !p.syncing && status.syncing) {
      toast({ title: 'Sincronizando…', description: 'Enviando e atualizando dados', });
    }
    // Sync success
    if (p && p.syncing && !status.syncing && !status.lastError) {
      toast({ title: 'Sincronizado', description: status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : undefined });
    }
    // Error
    if ((status.lastError && !p?.lastError) || (status.lastError && p?.lastError !== status.lastError)) {
      toast({ title: 'Erro de sincronização', description: String(status.lastError), variant: 'destructive' as any });
    }
    // Offline notice
    if (p && p.isOnline && !status.isOnline) {
      toast({ title: 'Sem conexão', description: `Itens pendentes: ${status.pendingCount}` });
    }
    // Online notice
    if (p && !p.isOnline && status.isOnline && status.hasCredentials) {
      toast({ title: 'Conectado', description: 'Sincronização automática habilitada' });
    }
    prev.current = status;
  }, [status]);

  const badge = useMemo(() => {
    if (status.syncing) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-blue-50 border-blue-200 text-blue-700">
          <RefreshCw className="h-3 w-3 animate-spin" /> Sincronizando…
        </span>
      );
    }
    if (status.lastError) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-red-50 border-red-200 text-red-700">
          <AlertTriangle className="h-3 w-3" /> Erro de sync
        </span>
      );
    }
    if (!status.isOnline || status.pendingCount > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-orange-50 border-orange-200 text-orange-700">
          {!status.isOnline ? <CloudOff className="h-3 w-3" /> : <Cloud className="h-3 w-3" />} {status.pendingCount > 0 ? `Pendentes: ${status.pendingCount}` : 'Offline'}
        </span>
      );
    }
    if (status.hasCredentials && status.isOnline) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-green-50 border-green-200 text-green-700">
          <CheckCircle2 className="h-3 w-3" /> Conectado
        </span>
      );
    }
    return null;
  }, [status]);

  if (!badge) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50">
      {badge}
    </div>
  );
}


