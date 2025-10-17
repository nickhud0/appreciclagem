import { useEffect, useMemo, useRef, useState } from 'react';
import { onSyncStatus, type SyncStatus } from '@/services/syncEngine';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

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
    // Only show error notifications
    if ((status.lastError && !p?.lastError) || (status.lastError && p?.lastError !== status.lastError)) {
      toast({ title: 'Erro de sincronização', description: String(status.lastError), variant: 'destructive' as any });
    }
    prev.current = status;
  }, [status]);

  const badge = useMemo(() => {
    // Only render error indicator; stay silent otherwise
    if (status.lastError) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-red-50 border-red-200 text-red-700">
          <AlertTriangle className="h-3 w-3" /> Erro de sync
        </span>
      );
    }
    return null;
  }, [status.lastError]);

  if (!badge) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50">
      {badge}
    </div>
  );
}


