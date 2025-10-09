/**
 * Database Usage Examples
 * 
 * This file demonstrates how to use the SQLite database module
 * in various scenarios throughout the app.
 * 
 * NOTE: This is a documentation/example file. 
 * You can import and use these examples or create your own.
 */

import {
  insert,
  update,
  deleteFrom,
  selectAll,
  selectWhere,
  selectById,
  count,
  exists,
  executeQuery,
  executeTransaction,
  addToSyncQueue,
  getPendingSyncItems,
  markSyncItemAsSynced,
  type Material,
  type Comanda20,
  type DespesaMes,
  type SyncQueue
} from './index';

// =========================================================
// EXAMPLE 1: Material CRUD Operations
// =========================================================

export async function exampleMaterialOperations() {
  console.log('=== Material CRUD Operations ===');

  // CREATE: Add a new material
  const materialId = await insert('material', {
    data: new Date().toISOString(),
    nome: 'Alumínio',
    categoria: 'Metal',
    preco_compra: 5.50,
    preco_venda: 7.00,
    criado_por: 'admin@sistema.com',
    atualizado_por: 'admin@sistema.com',
    origem_offline: 0
  });
  console.log('Created material with ID:', materialId);

  // READ: Get all materials
  const allMaterials = await selectAll<Material>('material', 'nome ASC');
  console.log('All materials:', allMaterials);

  // READ: Get materials by category
  const metalMaterials = await selectWhere<Material>(
    'material',
    'categoria = ?',
    ['Metal'],
    'preco_venda DESC'
  );
  console.log('Metal materials:', metalMaterials);

  // READ: Get specific material
  const material = await selectById<Material>('material', materialId);
  console.log('Specific material:', material);

  // UPDATE: Update material price
  const updatedCount = await update(
    'material',
    {
      preco_venda: 8.00,
      atualizado_por: 'admin@sistema.com'
    },
    'id = ?',
    [materialId]
  );
  console.log('Updated materials:', updatedCount);

  // DELETE: Remove material (be careful!)
  // const deletedCount = await deleteFrom('material', 'id = ?', [materialId]);
  // console.log('Deleted materials:', deletedCount);
}

// =========================================================
// EXAMPLE 2: Complex Queries with Joins
// =========================================================

export async function exampleComplexQueries() {
  console.log('=== Complex Query Examples ===');

  // Get total sales by material
  const salesByMaterial = await executeQuery<{
    material_nome: string;
    total_kg: number;
    total_valor: number;
  }>(`
    SELECT 
      m.nome as material_nome,
      SUM(c.kg_total) as total_kg,
      SUM(c.item_valor_total) as total_valor
    FROM material m
    JOIN comanda_20 c ON c.material_id = m.id
    WHERE c.comanda_tipo = 'VENDA'
    GROUP BY m.nome
    ORDER BY total_valor DESC
  `);
  console.log('Sales by material:', salesByMaterial);

  // Get inventory summary
  const inventorySummary = await executeQuery(`
    SELECT 
      material,
      kg_total,
      valor_medio_kg,
      valor_total_gasto,
      (kg_total * valor_medio_kg) as valor_estimado
    FROM estoque
    ORDER BY valor_total_gasto DESC
  `);
  console.log('Inventory summary:', inventorySummary);
}

// =========================================================
// EXAMPLE 3: Transactions for Data Consistency
// =========================================================

export async function exampleTransactions() {
  console.log('=== Transaction Example ===');

  try {
    // Create a purchase transaction (compra)
    await executeTransaction([
      // 1. Add to comanda_20
      {
        statement: `
          INSERT INTO comanda_20 
          (comanda_id, comanda_data, codigo, comanda_tipo, material_id, preco_kg, kg_total, item_valor_total, origem_offline)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          1,
          new Date().toISOString(),
          'COMP-001',
          'COMPRA',
          1,
          5.50,
          100,
          550,
          0
        ]
      },
      // 2. Update inventory
      {
        statement: `
          UPDATE estoque 
          SET kg_total = kg_total + ?,
              valor_total_gasto = valor_total_gasto + ?
          WHERE material = ?
        `,
        values: [100, 550, 'Alumínio']
      }
    ]);

    console.log('Transaction completed successfully');
  } catch (error) {
    console.error('Transaction failed:', error);
  }
}

// =========================================================
// EXAMPLE 4: Offline-First Pattern
// =========================================================

export async function exampleOfflineFirst() {
  console.log('=== Offline-First Pattern ===');

  // Scenario: User creates a material while offline
  const materialData = {
    data: new Date().toISOString(),
    nome: 'Papelão',
    categoria: 'Papel',
    preco_compra: 0.80,
    preco_venda: 1.20,
    criado_por: 'user@mobile.com',
    atualizado_por: 'user@mobile.com',
    origem_offline: 1  // Mark as created offline
  };

  // 1. Insert locally
  const localId = await insert('material', materialData);
  console.log('Created offline record with local ID:', localId);

  // 2. Add to sync queue
  await addToSyncQueue('material', 'INSERT', localId, {
    ...materialData,
    id: localId
  });
  console.log('Added to sync queue');

  // 3. Later, when online, process sync queue
  const pendingItems = await getPendingSyncItems();
  console.log('Pending sync items:', pendingItems.length);

  for (const item of pendingItems) {
    try {
      // Send to server API
      // const response = await fetch('https://api.example.com/sync', {
      //   method: 'POST',
      //   body: item.payload
      // });
      
      // If successful, mark as synced
      await markSyncItemAsSynced(item.id);
      console.log('Synced item:', item.id);
    } catch (error) {
      console.error('Sync failed for item:', item.id, error);
      // Will retry on next sync
    }
  }
}

// =========================================================
// EXAMPLE 5: Utility Functions
// =========================================================

export async function exampleUtilities() {
  console.log('=== Utility Functions ===');

  // Count operations
  const totalMaterials = await count('material');
  console.log('Total materials:', totalMaterials);

  const metalCount = await count('material', 'categoria = ?', ['Metal']);
  console.log('Metal materials:', metalCount);

  // Existence check
  const hasPlastic = await exists('material', 'categoria = ?', ['Plástico']);
  console.log('Has plastic materials:', hasPlastic);

  // Check for specific material
  const hasAluminio = await exists('material', 'nome = ?', ['Alumínio']);
  console.log('Has alumínio:', hasAluminio);
}

// =========================================================
// EXAMPLE 6: Working with Reports
// =========================================================

export async function exampleReports() {
  console.log('=== Reports Example ===');

  // Get daily report
  const today = new Date().toISOString().split('T')[0];
  const dailyReport = await selectWhere(
    'relatorio_diario',
    'data = ?',
    [today]
  );
  console.log('Today\'s report:', dailyReport);

  // Get current month report
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const monthlyReport = await selectWhere(
    'relatorio_mensal',
    'referencia = ?',
    [currentMonth]
  );
  console.log('Monthly report:', monthlyReport);

  // Calculate profit margin
  if (monthlyReport.length > 0) {
    const report = monthlyReport[0];
    const margin = ((report.lucro / report.venda) * 100).toFixed(2);
    console.log(`Profit margin: ${margin}%`);
  }
}

// =========================================================
// EXAMPLE 7: Working with Expenses
// =========================================================

export async function exampleExpenses() {
  console.log('=== Expenses Example ===');

  // Add a new expense
  const expenseId = await insert('despesa_mes', {
    data: new Date().toISOString(),
    descricao: 'Conta de luz',
    valor: 350.00,
    criado_por: 'admin@sistema.com',
    atualizado_por: 'admin@sistema.com',
    origem_offline: 0
  });
  console.log('Created expense with ID:', expenseId);

  // Get all expenses for current month
  const currentMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = await executeQuery<DespesaMes>(`
    SELECT * FROM despesa_mes
    WHERE strftime('%Y-%m', data) = ?
    ORDER BY data DESC
  `, [currentMonth]);
  console.log('Monthly expenses:', monthlyExpenses);

  // Calculate total expenses
  const totalExpenses = monthlyExpenses.reduce((sum, expense) => {
    return sum + (expense.valor || 0);
  }, 0);
  console.log('Total expenses this month:', totalExpenses);
}

// =========================================================
// EXAMPLE 8: Stock Management
// =========================================================

export async function exampleStockManagement() {
  console.log('=== Stock Management Example ===');

  // Get all stock items
  const stockItems = await selectAll('estoque', 'kg_total DESC');
  console.log('Stock items:', stockItems);

  // Find low stock items (less than 100kg)
  const lowStockQuery = await executeQuery(`
    SELECT * FROM estoque
    WHERE kg_total < 100
    ORDER BY kg_total ASC
  `);
  console.log('Low stock items:', lowStockQuery);

  // Calculate total inventory value
  const inventoryValue = await executeQuery<{ total_value: number }>(`
    SELECT SUM(valor_total_gasto) as total_value
    FROM estoque
  `);
  console.log('Total inventory value:', inventoryValue[0]?.total_value || 0);
}

// =========================================================
// EXAMPLE 9: Data Validation Before Insert
// =========================================================

export async function exampleDataValidation() {
  console.log('=== Data Validation Example ===');

  const newMaterialName = 'Cobre';

  // Check if material already exists
  const materialExists = await exists('material', 'nome = ?', [newMaterialName]);

  if (materialExists) {
    console.warn('Material already exists!');
    return;
  }

  // Validate prices
  const precoCompra = 8.00;
  const precoVenda = 7.00;

  if (precoVenda <= precoCompra) {
    console.error('Validation error: Sale price must be higher than purchase price');
    return;
  }

  // Insert if validation passes
  const materialId = await insert('material', {
    data: new Date().toISOString(),
    nome: newMaterialName,
    categoria: 'Metal',
    preco_compra: precoCompra,
    preco_venda: precoVenda,
    criado_por: 'admin@sistema.com',
    atualizado_por: 'admin@sistema.com',
    origem_offline: 0
  });

  console.log('Material created successfully with ID:', materialId);
}

// =========================================================
// EXAMPLE 10: Export All Examples as a Demo
// =========================================================

export async function runAllExamples() {
  console.log('🚀 Running all database examples...\n');

  try {
    await exampleMaterialOperations();
    console.log('\n');

    await exampleComplexQueries();
    console.log('\n');

    await exampleUtilities();
    console.log('\n');

    await exampleReports();
    console.log('\n');

    await exampleExpenses();
    console.log('\n');

    await exampleStockManagement();
    console.log('\n');

    await exampleDataValidation();
    console.log('\n');

    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}
