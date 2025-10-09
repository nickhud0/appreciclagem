import { ArrowLeft, Settings, Cloud, CloudOff, Save, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseSettings, saveSupabaseSettings, getComandaPrefix, setComandaPrefix } from "@/services/settings";
import { onSyncStatus, triggerSyncNow, notifyCredentialsUpdated, type SyncStatus } from "@/services/syncEngine";
import { executeQuery, addToSyncQueue, count } from "@/database";

const Configuracoes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefixSaving, setPrefixSaving] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: false,
    hasCredentials: false,
    syncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    lastError: null
  });

  const [fechamento, setFechamento] = useState<{
    desde_data: string | null;
    ate_data: string | null;
    compra: number | null;
    despesa: number | null;
    venda: number | null;
    lucro: number | null;
  } | null>(null);
  const [observacao, setObservacao] = useState("");
  const [fechando, setFechando] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const prevStatusRef = useRef<SyncStatus | null>(null);

  useEffect(() => {
    // Load saved settings
    const s = getSupabaseSettings();
    if (s) {
      setUrl(s.url);
      setAnonKey(s.anonKey);
    }
    // Load comanda prefix
    setCodigoPrefix(getComandaPrefix());

    // Subscribe to sync status
    const unsubscribe = onSyncStatus((st) => setStatus(st));
    return () => unsubscribe();
  }, []);

  const connected = status.hasCredentials && status.isOnline;

  const connectionBadge = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        {connected ? (
          <span className="inline-flex items-center text-green-600 bg-green-100 border border-green-200 px-2 py-1 rounded text-xs">
            <Cloud className="h-3 w-3 mr-1" /> Conectado
          </span>
        ) : (
          <span className="inline-flex items-center text-red-600 bg-red-100 border border-red-200 px-2 py-1 rounded text-xs">
            <CloudOff className="h-3 w-3 mr-1" /> Offline
          </span>
        )}
      </div>
    );
  }, [connected]);

  async function refreshPendingCount() {
    try {
      const c = await count('sync_queue', 'synced = ?', [0]);
      setPendingCount(c);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshPendingCount();
  }, []);

  useEffect(() => {
    // Update pending count and show toasts on status transitions
    void refreshPendingCount();

    const prev = prevStatusRef.current;
    if (prev && !prev.syncing && status.syncing) {
      toast({ title: 'Sincronizando…', description: 'Enviando e atualizando dados' });
    }
    if (prev && prev.syncing && !status.syncing && !status.lastError) {
      toast({ title: 'Sincronizado', description: status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : undefined });
    }
    if ((status.lastError && !prev?.lastError) || (status.lastError && prev?.lastError !== status.lastError)) {
      toast({ title: 'Erro de sincronização', description: String(status.lastError), variant: 'destructive' as any });
    }
    prevStatusRef.current = status;
  }, [status]);

  const currentStatus = useMemo(() => {
    if (status.syncing) return { label: 'Sincronizando…', color: 'text-blue-600', dot: 'bg-blue-500' };
    if (status.lastError) return { label: 'Erro', color: 'text-red-600', dot: 'bg-red-500' };
    if (status.lastSyncAt) return { label: 'Sucesso', color: 'text-green-600', dot: 'bg-green-500' };
    return { label: 'Ocioso', color: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  }, [status]);

  async function handleSave() {
    if (!url.trim() || !anonKey.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe a Supabase URL e a Anon Key",
        variant: "destructive"
      });
      return;
    }
    setSaving(true);
    try {
      saveSupabaseSettings({ url: url.trim(), anonKey: anonKey.trim() });
      notifyCredentialsUpdated();
      triggerSyncNow();
      toast({ title: "Configurações salvas", description: "Sincronização iniciada" });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Comanda prefix state and save handler
  const [codigoPrefix, setCodigoPrefix] = useState("");
  function normalizePrefix(v: string) {
    return (v || "").toUpperCase().replace(/\s+/g, '').slice(0, 8);
  }
  async function handleSavePrefix() {
    setPrefixSaving(true);
    try {
      setComandaPrefix(normalizePrefix(codigoPrefix));
      toast({ title: "Prefixo salvo", description: "O código da comanda usará este prefixo" });
    } catch {
      toast({ title: "Erro ao salvar prefixo", variant: "destructive" });
    } finally {
      setPrefixSaving(false);
    }
  }

  async function loadFechamentoAtual() {
    try {
      const rows = await executeQuery<any>(
        `SELECT desde_data, ate_data, compra, despesa, venda, lucro FROM calculo_fechamento ORDER BY rowid DESC LIMIT 1`
      );
      setFechamento(rows[0] || null);
    } catch (error) {
      setFechamento(null);
    }
  }

  useEffect(() => {
    void loadFechamentoAtual();
  }, []);

  async function handleFechamento() {
    if (!connected) {
      toast({ title: "Sem conexão", description: "Conecte-se à nuvem para fechar.", variant: "destructive" });
      return;
    }
    if (!fechamento) {
      toast({ title: "Dados indisponíveis", description: "Recarregue o cálculo de fechamento.", variant: "destructive" });
      return;
    }
    setFechando(true);
    try {
      const payload = {
        desde_data: fechamento.desde_data,
        ate_data: fechamento.ate_data,
        compra: fechamento.compra,
        despesa: fechamento.despesa,
        venda: fechamento.venda,
        lucro: fechamento.lucro,
        observacao: observacao || null
      };

      const syntheticId = `fech_${Date.now()}`;
      await addToSyncQueue('fechamento', 'INSERT', syntheticId, payload);

      // Dispara sync imediato
      triggerSyncNow();

      toast({
        title: "Fechamento enviado",
        description: "Fechamento foi enfileirado para sincronização",
      });
      setObservacao("");
    } catch (error) {
      toast({ title: "Erro ao fechar", variant: "destructive" });
    } finally {
      setFechando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="mr-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        </div>
        <div className="flex items-center gap-3">
          {connectionBadge}
          {status.syncing && (
            <span className="text-xs text-muted-foreground">Sincronizando...</span>
          )}
        </div>
      </div>

      {/* Supabase Config */}
      <Card className="p-6 mb-6">
        <div className="flex items-center mb-6">
          <Settings className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Configurações do Supabase</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="supabase-url">Supabase URL</Label>
            <Input
              id="supabase-url"
              placeholder="https://YOUR-PROJECT.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="supabase-key">Supabase Anon Key</Label>
            <Input
              id="supabase-key"
              type="password"
              placeholder="eyJhbGciOiJI..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              <div>Última sincronização: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : '—'}</div>
              <div>Pendentes: {status.pendingCount}</div>
              {status.lastError && (
                <div className="text-red-600">Erro: {status.lastError}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => triggerSyncNow()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Agora
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Comandas - Prefixo do Código */}
      <Card className="p-6 mb-6">
        <div className="flex items-center mb-6">
          <Settings className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Comandas</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="comanda-prefix">Prefixo do Código da Comanda</Label>
            <Input
              id="comanda-prefix"
              placeholder="Ex.: TR"
              value={codigoPrefix}
              onChange={(e) => setCodigoPrefix(normalizePrefix(e.target.value))}
              className="mt-1"
            />
            <div className="text-xs text-muted-foreground mt-1">Será usado como prefixo ao gerar o código, por exemplo TR-1</div>
          </div>
          <div className="flex items-center justify-end">
            <Button onClick={handleSavePrefix} disabled={prefixSaving}>
              <Save className="h-4 w-4 mr-2" /> {prefixSaving ? 'Salvando...' : 'Salvar Prefixo'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Fechamento */}
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <CheckCircle2 className="h-6 w-6 text-primary mr-3" />
          <h2 className="text-lg font-semibold">Realizar Fechamento</h2>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {fechamento ? (
              <div className="grid grid-cols-2 gap-3">
                <div>Desde: <span className="font-medium text-foreground">{fechamento.desde_data || '—'}</span></div>
                <div>Até: <span className="font-medium text-foreground">{fechamento.ate_data || '—'}</span></div>
                <div>Compra: <span className="font-medium text-foreground">{fechamento.compra ?? '—'}</span></div>
                <div>Despesa: <span className="font-medium text-foreground">{fechamento.despesa ?? '—'}</span></div>
                <div>Venda: <span className="font-medium text-foreground">{fechamento.venda ?? '—'}</span></div>
                <div>Lucro: <span className="font-medium text-foreground">{fechamento.lucro ?? '—'}</span></div>
              </div>
            ) : (
              <span>Sem dados de fechamento no momento.</span>
            )}
          </div>
          <Button variant="outline" onClick={() => loadFechamentoAtual()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        <div className="mb-4">
          <Label htmlFor="observacao">Observação (opcional)</Label>
          <textarea
            id="observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full mt-1 p-2 border border-input rounded-md bg-background text-sm min-h-[100px]"
            placeholder="Digite uma observação para o fechamento"
          />
        </div>

        <Button onClick={handleFechamento} disabled={!connected || fechando || !fechamento} className="w-full">
          <CheckCircle2 className="h-4 w-4 mr-2" /> {fechando ? 'Processando...' : 'Realizar Fechamento'}
        </Button>
      </Card>

      {/* Sync Details */}
      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="inline-flex items-center text-green-600 bg-green-100 border border-green-200 px-2 py-1 rounded text-xs">
                <Cloud className="h-3 w-3 mr-1" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center text-red-600 bg-red-100 border border-red-200 px-2 py-1 rounded text-xs">
                <CloudOff className="h-3 w-3 mr-1" /> Offline
              </span>
            )}
            <span className={`inline-flex items-center gap-2 text-xs ${currentStatus.color}`}>
              <span className={`w-2 h-2 rounded-full ${currentStatus.dot}`} />
              {currentStatus.label}
            </span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => triggerSyncNow()}
                  disabled={!connected || status.syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${status.syncing ? 'animate-spin' : ''}`} />
                  Sincronizar Agora
                </Button>
              </TooltipTrigger>
              {!connected && (
                <TooltipContent>
                  Requer conexão com a internet
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Última sincronização</div>
            <div className="font-medium text-foreground">{status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : '—'}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Registros pendentes</div>
            <div className="font-medium text-foreground">{pendingCount}</div>
          </div>
        </div>
        {status.lastError && (
          <div className="mt-4 text-xs text-red-600 break-words">Erro: {status.lastError}</div>
        )}
      </Card>
    </div>
  );
};

export default Configuracoes;