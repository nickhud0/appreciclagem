# 🏗️ Arquitetura do Banco de Dados SQLite

## 📐 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        React App (UI Layer)                      │
│                    src/pages/* src/components/*                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Import & Use
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Module (API Layer)                   │
│                         src/database/                            │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   index.ts   │  │   types.ts   │  │  README.md   │          │
│  │  (exports)   │  │  (TypeScript │  │(documentation)│          │
│  └──────────────┘  │  interfaces) │  └──────────────┘          │
│                    └──────────────┘                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              sqliteService.ts                             │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  • executeQuery()      • insert()                  │  │  │
│  │  │  • executeStatement()  • update()                  │  │  │
│  │  │  • executeTransaction()• deleteFrom()              │  │  │
│  │  │  • selectAll()         • count()                   │  │  │
│  │  │  • selectWhere()       • exists()                  │  │  │
│  │  │  • selectById()        • clearTable()              │  │  │
│  │  │  • addToSyncQueue()    • getDatabaseStats()        │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             │ Uses                               │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              initDatabase.ts                              │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  • initializeDatabase()                            │  │  │
│  │  │  • getDatabase()                                   │  │  │
│  │  │  • getSQLiteConnection()                           │  │  │
│  │  │  • closeDatabase()                                 │  │  │
│  │  │  • isDatabaseInitialized()                         │  │  │
│  │  │  • DATABASE_SCHEMA (from sqlite_schema.sql)       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │ Uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               @capacitor-community/sqlite (Plugin)               │
│                 SQLiteConnection, SQLiteDBConnection             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Platform-specific
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Native SQLite Database                        │
│                                                                   │
│  📱 Android: /data/data/com.reciclagem.pereque/databases/       │
│  🍎 iOS: Library/CapacitorDatabase/                             │
│  🌐 Web: IndexedDB (via jeep-sqlite)                            │
│                                                                   │
│                    reciclagem.db (19 tables)                     │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Fluxo de Inicialização

```
App Start (main.tsx)
    │
    ├─→ initializeMobileFeatures()
    │       │
    │       ├─→ initializeDatabase()
    │       │       │
    │       │       ├─→ initializeSQLitePlugin()
    │       │       │       │
    │       │       │       ├─→ Create SQLiteConnection
    │       │       │       │
    │       │       │       └─→ [Web] Initialize jeep-sqlite
    │       │       │
    │       │       ├─→ checkDatabaseExists()
    │       │       │       │
    │       │       │       ├─→ [YES] Open existing database
    │       │       │       │
    │       │       │       └─→ [NO] Create new database
    │       │       │               │
    │       │       │               └─→ Execute DATABASE_SCHEMA
    │       │       │
    │       │       └─→ verifyTables()
    │       │               │
    │       │               └─→ Check all 19 tables exist
    │       │
    │       └─→ [Mobile] Configure StatusBar & SplashScreen
    │
    └─→ Render React App
            │
            └─→ Database ready for use! ✅
```

## 📊 Estrutura de Dados - Offline First

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│                                                                   │
│  User creates/updates data  ──┐                                 │
└────────────────────────────────┼──────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Local SQLite DB                             │
│                                                                   │
│  1. Save to table (e.g., material)                              │
│     └─→ origem_offline = 1                                      │
│                                                                   │
│  2. Add to sync_queue                                           │
│     └─→ { table_name, operation, payload, synced: 0 }          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ When online
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Synchronization Process                       │
│                                                                   │
│  1. Get pending items (synced = 0)                             │
│  2. Send to server API                                          │
│  3. Mark as synced (synced = 1)                                │
│  4. Update origem_offline = 0                                   │
│  5. Set data_sync = current_timestamp                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Remote Server (Supabase)                    │
│                    Data persisted in cloud ☁️                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🗂️ Organização dos Dados (19 Tabelas)

```
reciclagem.db
│
├── 📦 Dados Principais
│   ├── material              (catálogo de materiais)
│   ├── vale_false            (vales/adiantamentos)
│   └── pendencia_false       (pendências)
│
├── 💰 Transações
│   ├── comanda_20            (últimas 20 comandas)
│   └── ultimas_20            (últimas 20 transações)
│
├── 📊 Relatórios
│   ├── relatorio_diario      (relatórios diários)
│   ├── relatorio_mensal      (relatórios mensais)
│   └── relatorio_anual       (relatórios anuais)
│
├── 📈 Análise por Material
│   ├── compra_por_material_diario   (compras diárias)
│   ├── compra_por_material_mes      (compras mensais)
│   ├── compra_por_material_anual    (compras anuais)
│   ├── venda_por_material_diario    (vendas diárias)
│   ├── venda_por_material_mes       (vendas mensais)
│   └── venda_por_material_anual     (vendas anuais)
│
├── 💼 Gestão Financeira
│   ├── fechamento_mes        (fechamentos mensais)
│   ├── despesa_mes          (despesas mensais)
│   └── calculo_fechamento   (cálculos de fechamento)
│
├── 📦 Estoque
│   └── estoque              (controle de estoque)
│
└── 🔄 Sincronização
    └── sync_queue           (fila de sincronização offline)
```

## 🔌 Integração com React Components

### Exemplo: Hook Personalizado

```typescript
// src/hooks/useMaterials.ts
import { useState, useEffect } from 'react';
import { selectAll, insert, update, deleteFrom, type Material } from '@/database';

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load materials
  const loadMaterials = async () => {
    try {
      setLoading(true);
      const data = await selectAll<Material>('material', 'nome ASC');
      setMaterials(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  // Add material
  const addMaterial = async (material: Omit<Material, 'id'>) => {
    try {
      const id = await insert('material', material);
      await loadMaterials();
      return id;
    } catch (err) {
      throw err;
    }
  };

  // Update material
  const updateMaterial = async (id: number, data: Partial<Material>) => {
    try {
      await update('material', data, 'id = ?', [id]);
      await loadMaterials();
    } catch (err) {
      throw err;
    }
  };

  // Delete material
  const deleteMaterial = async (id: number) => {
    try {
      await deleteFrom('material', 'id = ?', [id]);
      await loadMaterials();
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  return {
    materials,
    loading,
    error,
    refresh: loadMaterials,
    add: addMaterial,
    update: updateMaterial,
    delete: deleteMaterial
  };
}
```

### Exemplo: Componente React

```typescript
// src/pages/Materiais.tsx
import { useMaterials } from '@/hooks/useMaterials';

export default function MateriaisPage() {
  const { materials, loading, error, add, update, delete: remove } = useMaterials();

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h1>Materiais</h1>
      {materials.map(material => (
        <div key={material.id}>
          <h3>{material.nome}</h3>
          <p>Categoria: {material.categoria}</p>
          <p>Preço: R$ {material.preco_venda}</p>
        </div>
      ))}
    </div>
  );
}
```

## 🔐 Padrões de Segurança

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Layers                               │
│                                                                   │
│  1. Input Validation                                            │
│     └─→ TypeScript types catch errors at compile time          │
│                                                                   │
│  2. SQL Injection Prevention                                    │
│     └─→ Use parameterized queries (?, [...values])             │
│                                                                   │
│  3. Transaction Safety                                          │
│     └─→ BEGIN/COMMIT/ROLLBACK for atomic operations            │
│                                                                   │
│  4. Error Handling                                              │
│     └─→ Try-catch blocks and proper error propagation          │
│                                                                   │
│  5. Data Integrity                                              │
│     └─→ Foreign key constraints and type checking              │
└─────────────────────────────────────────────────────────────────┘
```

## 📱 Plataforma Específica

### Android
```
Storage: /data/data/com.reciclagem.pereque/databases/reciclagem.db
Engine: Native SQLite (via Capacitor plugin)
Size Limit: Device storage dependent
Encryption: Disabled (can be enabled in config)
```

### iOS
```
Storage: Library/CapacitorDatabase/reciclagem.db
Engine: Native SQLite (via Capacitor plugin)
Size Limit: Device storage dependent
Encryption: Disabled (can be enabled in config)
Keychain: Configured for biometric auth (if needed)
```

### Web/PWA
```
Storage: IndexedDB (via jeep-sqlite wrapper)
Engine: sql.js (SQLite compiled to WebAssembly)
Size Limit: ~50MB (browser dependent)
Persistence: Persistent storage API used
```

## 🚀 Performance Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                    Performance Optimizations                     │
│                                                                   │
│  ✅ Indexes (add as needed for frequently queried columns)      │
│  ✅ Batch operations via executeTransaction()                   │
│  ✅ Lazy loading (load data only when needed)                   │
│  ✅ Connection pooling (single global connection)               │
│  ✅ Prepared statements (via parameterized queries)             │
│  ✅ Minimal data transfer (select only needed columns)          │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Maintenance & Monitoring

```typescript
// Get database statistics
import { getDatabaseStats } from '@/database';

const stats = await getDatabaseStats();
console.table(stats);

// Output:
// ┌───────────────────────────┬───────┐
// │          Table            │ Count │
// ├───────────────────────────┼───────┤
// │ material                  │   45  │
// │ comanda_20                │  150  │
// │ estoque                   │   38  │
// │ ...                       │  ...  │
// └───────────────────────────┴───────┘
```

## 🎯 Best Practices

1. **Always use TypeScript types** - Catch errors at compile time
2. **Use transactions for related operations** - Maintain data consistency
3. **Handle errors gracefully** - Always use try-catch
4. **Log operations in development** - Use the built-in logger
5. **Test offline scenarios** - Ensure offline-first works
6. **Keep queries simple** - Optimize complex queries
7. **Use the service layer** - Don't access DB directly from components
8. **Validate input data** - Before inserting into database
9. **Monitor database size** - Clean old data periodically
10. **Backup important data** - Before destructive operations

---

**📅 Última atualização**: 05/10/2025  
**🔢 Versão da arquitetura**: 1.0.0
