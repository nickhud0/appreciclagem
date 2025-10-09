/**
 * Hook simples para gerenciar transações no localStorage
 * Frontend-only, sem backend
 */

import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface Transacao {
  id: number;
  tipo: 'compra' | 'venda';
  material_id: number;
  peso: number;
  valor_total: number;
  observacoes?: string;
  created_at: string;
}

export function useTransacoes() {
  const [transacoes, setTransacoes] = useLocalStorage<Transacao[]>('transacoes', []);
  const [loading, setLoading] = useState(false);

  const addTransacao = (transacao: Omit<Transacao, 'id' | 'created_at'>) => {
    const newTransacao: Transacao = {
      ...transacao,
      id: Date.now(),
      created_at: new Date().toISOString()
    };
    
    setTransacoes(prev => [...prev, newTransacao]);
    return newTransacao;
  };

  const deleteTransacao = (id: number) => {
    setTransacoes(prev => prev.filter(transacao => transacao.id !== id));
  };

  return {
    transacoes,
    loading,
    addTransacao,
    deleteTransacao
  };
}
