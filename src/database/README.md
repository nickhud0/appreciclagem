# SQLite Database Module

This module provides a complete SQLite database implementation for the offline-first React + Vite + Capacitor app.

## 📋 Overview

- **Database Name**: `reciclagem.db`
- **Location**: Device-specific (see Capacitor config)
- **Tables**: 19 tables with complete schema
- **Plugin**: `@capacitor-community/sqlite` v7.0.1
- **Platforms**: Android, iOS, and Web (with jeep-sqlite)

## 🚀 Quick Start

The database is automatically initialized when the app starts. You can use it throughout your app:

```typescript
import { insert, selectAll, Material } from '@/database';

// Insert a new material
const materialId = await insert('material', {
  data: new Date().toISOString(),
  nome: 'Alumínio',
  categoria: 'Metal',
  preco_compra: 5.50,
  preco_venda: 7.00,
  criado_por: 'user@example.com',
  atualizado_por: 'user@example.com',
  origem_offline: 1
});

// Select all materials
const materials = await selectAll<Material>('material');
console.log('Materials:', materials);
```

## 📚 Database Structure

### Tables

1. **material** - Recyclable materials catalog
2. **vale_false** - Vouchers/IOUs
3. **pendencia_false** - Pending transactions
4. **comanda_20** - Last 20 orders
5. **fechamento_mes** - Monthly closings
6. **relatorio_diario** - Daily reports
7. **relatorio_mensal** - Monthly reports
8. **relatorio_anual** - Annual reports
9. **compra_por_material_diario** - Daily purchases by material
10. **compra_por_material_mes** - Monthly purchases by material
11. **compra_por_material_anual** - Annual purchases by material
12. **venda_por_material_diario** - Daily sales by material
13. **venda_por_material_mes** - Monthly sales by material
14. **venda_por_material_anual** - Annual sales by material
15. **ultimas_20** - Last 20 transactions
16. **estoque** - Inventory
17. **despesa_mes** - Monthly expenses
18. **calculo_fechamento** - Closing calculations
19. **sync_queue** - Synchronization queue

## 🔧 API Reference

### Initialization Functions

```typescript
import { initializeDatabase, getDatabase, isDatabaseInitialized } from '@/database';

// Initialize database (called automatically on app start)
await initializeDatabase();

// Get current database connection
const db = getDatabase();

// Check if database is initialized
const isReady = isDatabaseInitialized();
```

### Query Functions

#### Select Operations

```typescript
import { selectAll, selectWhere, selectById } from '@/database';

// Select all records
const allMaterials = await selectAll('material', 'nome ASC');

// Select with WHERE clause
const activeMaterials = await selectWhere(
  'material',
  'categoria = ?',
  ['Metal'],
  'nome ASC'
);

// Select by ID
const material = await selectById('material', 1);
```

#### Insert Operations

```typescript
import { insert } from '@/database';

const newId = await insert('material', {
  data: new Date().toISOString(),
  nome: 'Plástico PET',
  categoria: 'Plástico',
  preco_compra: 2.50,
  preco_venda: 3.50,
  criado_por: 'user@example.com',
  atualizado_por: 'user@example.com'
});
```

#### Update Operations

```typescript
import { update } from '@/database';

const updated = await update(
  'material',
  { preco_venda: 8.00, atualizado_por: 'admin@example.com' },
  'id = ?',
  [1]
);
```

#### Delete Operations

```typescript
import { deleteFrom } from '@/database';

const deleted = await deleteFrom('material', 'id = ?', [1]);
```

#### Utility Functions

```typescript
import { count, exists, clearTable } from '@/database';

// Count records
const totalMaterials = await count('material');
const metalCount = await count('material', 'categoria = ?', ['Metal']);

// Check existence
const hasPlastic = await exists('material', 'categoria = ?', ['Plástico']);

// Clear all records (use with caution!)
await clearTable('material');
```

### Advanced Operations

#### Custom Queries

```typescript
import { executeQuery } from '@/database';

const results = await executeQuery(`
  SELECT m.nome, SUM(c.kg_total) as total_kg
  FROM material m
  JOIN comanda_20 c ON c.material_id = m.id
  GROUP BY m.nome
`);
```

#### Transactions

```typescript
import { executeTransaction } from '@/database';

await executeTransaction([
  {
    statement: 'INSERT INTO material (data, nome, categoria, preco_compra, preco_venda, criado_por, atualizado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
    values: [new Date().toISOString(), 'Vidro', 'Vidro', 1.0, 2.0, 'user', 'user']
  },
  {
    statement: 'UPDATE estoque SET kg_total = kg_total + ? WHERE material = ?',
    values: [100, 'Vidro']
  }
]);
```

### Sync Queue Operations

```typescript
import { addToSyncQueue, getPendingSyncItems, markSyncItemAsSynced } from '@/database';

// Add operation to sync queue
await addToSyncQueue('material', 'INSERT', 123, {
  id: 123,
  nome: 'New Material',
  // ... other fields
});

// Get pending items
const pending = await getPendingSyncItems();

// Mark as synced
await markSyncItemAsSynced(pending[0].id);
```

## 🎯 TypeScript Support

All database tables have TypeScript interfaces defined:

```typescript
import type { Material, Comanda20, SyncQueue } from '@/database';

const material: Material = {
  data: new Date().toISOString(),
  nome: 'Alumínio',
  categoria: 'Metal',
  preco_compra: 5.50,
  preco_venda: 7.00,
  criado_por: 'user@example.com',
  atualizado_por: 'user@example.com',
  origem_offline: 1
};
```

## 📊 Database Statistics

```typescript
import { getDatabaseStats } from '@/database';

const stats = await getDatabaseStats();
console.log(stats);
// Output:
// {
//   material: 45,
//   vale_false: 12,
//   comanda_20: 150,
//   ...
// }
```

## 🔄 Offline-First Pattern

The database supports offline-first architecture with:

1. **origem_offline** field: Marks records created while offline
2. **data_sync** field: Tracks last sync timestamp
3. **sync_queue** table: Queues operations for later synchronization

### Example: Create Offline Record

```typescript
import { insert, addToSyncQueue } from '@/database';

// Create record locally
const recordId = await insert('material', {
  data: new Date().toISOString(),
  nome: 'New Material',
  categoria: 'Metal',
  preco_compra: 5.0,
  preco_venda: 6.0,
  criado_por: 'user@example.com',
  atualizado_por: 'user@example.com',
  origem_offline: 1  // Mark as offline
});

// Add to sync queue
await addToSyncQueue('material', 'INSERT', recordId, {
  id: recordId,
  nome: 'New Material',
  // ... full record data
});
```

## ⚠️ Important Notes

1. **Initialization**: The database is automatically initialized in `main.tsx`. Don't call `initializeDatabase()` manually unless needed.

2. **Transactions**: Use transactions for related operations to maintain data integrity.

3. **Error Handling**: All database operations may throw errors. Always use try-catch blocks.

4. **Platform Differences**: Web platform requires `jeep-sqlite` custom element (automatically handled).

5. **Data Types**: SQLite uses TEXT for dates. Store dates as ISO strings.

## 🐛 Debugging

Check browser console or device logs for detailed database operations:

```
🔌 Initializing SQLite plugin...
✅ SQLite plugin initialized successfully
📦 Creating new database: reciclagem.db
✅ Database connection opened successfully
🔨 Executing database schema...
✅ Database schema executed successfully
🔍 Verifying database tables...
📋 Tables found in database: [...]
✅ Database verification successful! All 19 tables created correctly.
```

## 📝 Schema Source

The database schema is defined in `/sqlite_schema.sql` and embedded in `initDatabase.ts`. Any changes to the schema should be reflected in both files.

## 🔗 Related Files

- `src/database/initDatabase.ts` - Database initialization
- `src/database/sqliteService.ts` - Database operations
- `src/database/types.ts` - TypeScript definitions
- `src/database/index.ts` - Module exports
- `sqlite_schema.sql` - Schema definition
