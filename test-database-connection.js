/**
 * Script para testar conectividade com o banco Supabase
 * Execute: node test-database-connection.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configurações - substitua com suas credenciais
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anonima-aqui';

async function testConnection() {
  console.log('🔍 Testando conectividade com Supabase...\n');

  if (SUPABASE_URL === 'https://seu-projeto.supabase.co' || SUPABASE_ANON_KEY === 'sua-chave-anonima-aqui') {
    console.log('❌ Por favor, configure suas credenciais do Supabase no topo deste arquivo');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Tabelas obrigatórias
  const requiredTables = [
    'material',
    'comanda', 
    'item',
    'vale',
    'pendencia',
    'fechamento'
  ];

  // Views importantes
  const importantViews = [
    'estoque',
    'vw_estoque',
    'vw_vales',
    'vw_pendencias',
    'lucro_consolidado'
  ];

  let allPassed = true;

  console.log('📋 Testando tabelas obrigatórias:');
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count', { count: 'exact' })
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        allPassed = false;
      } else {
        console.log(`✅ ${table}: OK`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n🔍 Testando views importantes:');
  for (const view of importantViews) {
    try {
      const { data, error } = await supabase
        .from(view)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`⚠️  ${view}: ${error.message}`);
        // Views não são críticas, não falham o teste
      } else {
        console.log(`✅ ${view}: OK`);
      }
    } catch (err) {
      console.log(`⚠️  ${view}: ${err.message}`);
    }
  }

  console.log('\n🧪 Testando operações básicas:');

  // Teste de inserção e busca
  try {
    // Inserir material de teste
    const { data: insertData, error: insertError } = await supabase
      .from('material')
      .insert([{
        nome_material: 'TESTE_CONEXAO',
        preco_compra: 1.00,
        preco_venda: 2.00,
        categoria_material: 'teste'
      }])
      .select()
      .single();

    if (insertError) {
      console.log(`❌ Inserção: ${insertError.message}`);
      allPassed = false;
    } else {
      console.log(`✅ Inserção: OK (ID: ${insertData.id})`);

      // Limpar dados de teste
      await supabase
        .from('material')
        .delete()
        .eq('id', insertData.id);
      
      console.log(`🧹 Limpeza: Material de teste removido`);
    }
  } catch (err) {
    console.log(`❌ Teste de inserção: ${err.message}`);
    allPassed = false;
  }

  console.log('\n📊 RESULTADO FINAL:');
  if (allPassed) {
    console.log('🎉 SUCESSO! Todas as tabelas obrigatórias estão funcionando.');
    console.log('💡 Seu app deve conseguir conectar ao banco normalmente.');
  } else {
    console.log('❌ FALHA! Há problemas com algumas tabelas.');
    console.log('💡 Soluções recomendadas:');
    console.log('   1. Execute o arquivo schema_final.sql no SQL Editor do Supabase');
    console.log('   2. Verifique se as permissões RLS estão configuradas');
    console.log('   3. Confirme se suas credenciais estão corretas');
  }
}

// Executar teste
testConnection()
  .then(() => {
    console.log('\n✨ Teste de conectividade concluído.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro durante o teste:', error);
    process.exit(1);
  });
