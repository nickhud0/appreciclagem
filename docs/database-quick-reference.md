# 🚀 Database Quick Reference Card

## 📥 Import Statements

```typescript
// Basic operations
import { 
  insert, update, deleteFrom, 
  selectAll, selectWhere, selectById,
  count, exists
} from '@/database';

// Advanced operations
import { 
  executeQuery, executeTransaction,
  addToSyncQueue, getPendingSyncItems
} from '@/database';

// Types
import type { Material, Comanda20, SyncQueue } from '@/database';

// Database management
import { 
  initializeDatabase, getDatabase, 
  isDatabaseInitialized 
} from '@/database';
```

## ✍️ CREATE (Insert)

```typescript
// Simple insert
const id = await insert('material', {
  data: new Date().toISOString(),
  nome: 'Alumínio',
  categoria: 'Metal',
  preco_compra: 5.50,
  preco_venda: 7.00,
  criado_por: 'user@example.com',
  atualizado_por: 'user@example.com'
});

// With offline flag
const offlineId = await insert('material', {
  // ... fields
  origem_offline: 1  // Mark as created offline
});
```

## 📖 READ (Select)

```typescript
// Select all
const all = await selectAll('material');

// Select with order
const ordered = await selectAll('material', 'nome ASC');

// Select with WHERE
const filtered = await selectWhere(
  'material',
  'categoria = ?',
  ['Metal'],
  'preco_venda DESC'
);

// Select by ID
const one = await selectById('material', 1);

// Custom query
const custom = await executeQuery(`
  SELECT * FROM material 
  WHERE preco_venda > ? 
  ORDER BY nome
`, [5.00]);
```

## 🔄 UPDATE

```typescript
// Update single field
await update(
  'material',
  { preco_venda: 8.00 },
  'id = ?',
  [1]
);

// Update multiple fields
await update(
  'material',
  { 
    preco_venda: 8.00,
    atualizado_por: 'admin@example.com'
  },
  'id = ?',
  [1]
);

// Update multiple records
await update(
  'material',
  { preco_compra: 10.00 },
  'categoria = ?',
  ['Metal']
);
```

## 🗑️ DELETE

```typescript
// Delete by ID
await deleteFrom('material', 'id = ?', [1]);

// Delete by condition
await deleteFrom('material', 'categoria = ?', ['Obsoleto']);

// Clear entire table (careful!)
await clearTable('material');
```

## 🔢 UTILITIES

```typescript
// Count all
const total = await count('material');

// Count with condition
const metalCount = await count('material', 'categoria = ?', ['Metal']);

// Check existence
const exists = await exists('material', 'nome = ?', ['Alumínio']);

// Get statistics
const stats = await getDatabaseStats();
```

## 🔄 TRANSACTIONS

```typescript
await executeTransaction([
  {
    statement: 'INSERT INTO material (nome, categoria, preco_compra, preco_venda, criado_por, atualizado_por, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    values: ['PET', 'Plástico', 2.0, 3.0, 'user', 'user', new Date().toISOString()]
  },
  {
    statement: 'UPDATE estoque SET kg_total = kg_total + ? WHERE material = ?',
    values: [100, 'PET']
  }
]);
```

## 📴 OFFLINE-FIRST PATTERN

```typescript
// 1. Create offline record
const recordId = await insert('material', {
  // ... data
  origem_offline: 1
});

// 2. Add to sync queue
await addToSyncQueue('material', 'INSERT', recordId, {
  id: recordId,
  // ... full record data
});

// 3. Later, sync when online
const pending = await getPendingSyncItems();
for (const item of pending) {
  // Send to API
  await syncToServer(item);
  // Mark as synced
  await markSyncItemAsSynced(item.id);
}
```

## 🎯 COMMON PATTERNS

### Pattern 1: Load & Display

```typescript
async function loadMaterials() {
  try {
    const materials = await selectAll<Material>('material', 'nome ASC');
    return materials;
  } catch (error) {
    console.error('Error loading materials:', error);
    return [];
  }
}
```

### Pattern 2: Create with Validation

```typescript
async function createMaterial(data: Omit<Material, 'id'>) {
  // Validate
  if (data.preco_venda <= data.preco_compra) {
    throw new Error('Preço de venda deve ser maior que compra');
  }
  
  // Check duplicates
  const exists = await exists('material', 'nome = ?', [data.nome]);
  if (exists) {
    throw new Error('Material já existe');
  }
  
  // Insert
  return await insert('material', data);
}
```

### Pattern 3: Update with Audit

```typescript
async function updateMaterial(id: number, changes: Partial<Material>) {
  const updated = {
    ...changes,
    atualizado_por: getCurrentUser(),
    data_sync: new Date().toISOString()
  };
  
  return await update('material', updated, 'id = ?', [id]);
}
```

### Pattern 4: Safe Delete

```typescript
async function deleteMaterial(id: number) {
  // Check if used in other tables
  const inUse = await count('comanda_20', 'material_id = ?', [id]);
  
  if (inUse > 0) {
    throw new Error('Material em uso, não pode ser deletado');
  }
  
  return await deleteFrom('material', 'id = ?', [id]);
}
```

### Pattern 5: Complex Query

```typescript
async function getMonthlySalesReport(month: string) {
  return await executeQuery(`
    SELECT 
      m.nome as material,
      SUM(c.kg_total) as total_kg,
      SUM(c.item_valor_total) as total_valor,
      COUNT(*) as num_vendas
    FROM material m
    JOIN comanda_20 c ON c.material_id = m.id
    WHERE c.comanda_tipo = 'VENDA'
      AND strftime('%Y-%m', c.comanda_data) = ?
    GROUP BY m.nome
    ORDER BY total_valor DESC
  `, [month]);
}
```

## 📊 TABLE REFERENCE

| Table | Primary Key | Syncable | Description |
|-------|-------------|----------|-------------|
| material | id | ✅ | Catálogo de materiais |
| vale_false | id | ✅ | Vales/adiantamentos |
| pendencia_false | id | ✅ | Pendências |
| comanda_20 | - | ✅ | Últimas 20 comandas |
| fechamento_mes | id | ✅ | Fechamentos mensais |
| relatorio_diario | - | ❌ | Relatórios diários |
| relatorio_mensal | - | ❌ | Relatórios mensais |
| relatorio_anual | - | ❌ | Relatórios anuais |
| estoque | - | ❌ | Estoque atual |
| despesa_mes | id | ✅ | Despesas mensais |
| sync_queue | id | ❌ | Fila de sincronização |

## ⚠️ COMMON PITFALLS

### ❌ DON'T

```typescript
// Don't use string concatenation (SQL injection risk)
await executeQuery(`SELECT * FROM material WHERE nome = '${name}'`);

// Don't forget error handling
const data = await selectAll('material'); // Can throw!

// Don't use reserved keywords as column names
await insert('table', { date: '2025-10-05' }); // 'date' is reserved
```

### ✅ DO

```typescript
// Use parameterized queries
await executeQuery('SELECT * FROM material WHERE nome = ?', [name]);

// Always handle errors
try {
  const data = await selectAll('material');
} catch (error) {
  console.error('Error:', error);
}

// Use safe column names
await insert('material', { data: '2025-10-05' }); // Use 'data' not 'date'
```

## 🐛 DEBUGGING

```typescript
// Check if database is ready
import { isDatabaseInitialized } from '@/database';
console.log('DB Ready:', isDatabaseInitialized());

// Get database stats
import { getDatabaseStats } from '@/database';
const stats = await getDatabaseStats();
console.table(stats);

// Enable detailed logs
import { logger } from '@/utils/logger';
logger.info('My debug message');

// Test a specific table
const testData = await selectAll('material');
console.log('Materials:', testData);
```

## 🔗 USEFUL LINKS

- **Full Documentation**: `src/database/README.md`
- **Examples**: `src/database/example-usage.ts`
- **Architecture**: `docs/database-architecture.md`
- **Types**: `src/database/types.ts`
- **Verification Page**: `verify-database.html`

## 💡 PRO TIPS

1. **Use TypeScript types** - Import types from `@/database`
2. **Batch operations** - Use `executeTransaction()` for multiple operations
3. **Index frequently queried columns** - Add indexes for performance
4. **Clean old data** - Implement data retention policies
5. **Test offline** - Disconnect and test offline functionality
6. **Monitor database size** - Check stats regularly
7. **Use prepared statements** - Always use parameterized queries
8. **Validate before insert** - Check data before saving
9. **Handle errors gracefully** - Always try-catch async operations
10. **Log in development** - Use logger for debugging

---

**📌 Keep this card handy for quick reference!**  
**📅 Updated**: 05/10/2025
