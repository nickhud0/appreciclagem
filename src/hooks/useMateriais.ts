/**
 * Hook simples para gerenciar materiais no localStorage
 * Frontend-only, sem backend
 */

import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface Material {
  id: number;
  nome: string;
  preco_compra_kg: number;
  preco_venda_kg: number;
  categoria: string;
  created_at: string;
  updated_at: string;
}

export function useMateriais() {
  const [materiais, setMateriais] = useLocalStorage<Material[]>('materiais', []);
  const [loading, setLoading] = useState(false);

  const addMaterial = (material: Omit<Material, 'id' | 'created_at' | 'updated_at'>) => {
    const newMaterial: Material = {
      ...material,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setMateriais(prev => [...prev, newMaterial]);
    return newMaterial;
  };

  const updateMaterial = (id: number, updates: Partial<Material>) => {
    setMateriais(prev => 
      prev.map(material => 
        material.id === id 
          ? { ...material, ...updates, updated_at: new Date().toISOString() }
          : material
      )
    );
  };

  const deleteMaterial = (id: number) => {
    setMateriais(prev => prev.filter(material => material.id !== id));
  };

  return {
    materiais,
    loading,
    addMaterial,
    updateMaterial,
    deleteMaterial
  };
}
