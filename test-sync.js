/**
 * Script de teste para verificar sincronização
 * Execute no console do navegador para testar
 */

// Função para testar criação de material
async function testarCriacaoMaterial() {
  console.log('🧪 Testando criação de material...');
  
  try {
    // Simular dados de material
    const material = {
      nome: 'Papel Teste',
      preco_compra_kg: 1.50,
      preco_venda_kg: 2.00,
      categoria: 'Papel',
      created_at: new Date().toISOString()
    };
    
    // Verificar se supabaseService está disponível
    if (typeof window.supabaseService !== 'undefined') {
      const success = await window.supabaseService.createMaterial(material);
      console.log('✅ Material criado:', success);
      
      // Buscar materiais para verificar
      const materiais = await window.supabaseService.getMateriais();
      console.log('📋 Materiais encontrados:', materiais);
    } else {
      console.log('❌ supabaseService não disponível');
    }
  } catch (error) {
    console.error('❌ Erro ao testar material:', error);
  }
}

// Função para testar criação de comanda
async function testarCriacaoComanda() {
  console.log('🧪 Testando criação de comanda...');
  
  try {
    const comanda = {
      numero: 'TEST-001',
      tipo: 'compra',
      total: 100.00,
      observacoes: 'Teste de comanda',
      dispositivo: 'Teste',
      itens: [
        {
          material: 'Papel Teste', // Nome do material
          material_id: 1, // Será buscado automaticamente
          preco: 1.50,
          quantidade: 10,
          total: 15.00
        }
      ],
      created_at: new Date().toISOString()
    };
    
    if (typeof window.supabaseService !== 'undefined') {
      const success = await window.supabaseService.createComanda(comanda);
      console.log('✅ Comanda criada:', success);
      
      // Verificar se a comanda foi criada
      const comandas = await window.supabaseService.getComandas(5);
      console.log('📋 Comandas encontradas:', comandas);
    } else {
      console.log('❌ supabaseService não disponível');
    }
  } catch (error) {
    console.error('❌ Erro ao testar comanda:', error);
  }
}

// Função para verificar status da conexão
function verificarStatusConexao() {
  console.log('🔍 Verificando status da conexão...');
  
  if (typeof window.supabaseService !== 'undefined') {
    const status = window.supabaseService.getConnectionStatus();
    console.log('📡 Status da conexão:', status);
    
    if (status) {
      console.log('✅ Conectado ao Supabase');
    } else {
      console.log('❌ Não conectado ao Supabase');
    }
  } else {
    console.log('❌ supabaseService não disponível');
  }
}

// Função para limpar dados de teste
async function limparDadosTeste() {
  console.log('🧹 Limpando dados de teste...');
  
  try {
    // Limpar localStorage
    const keys = ['materiais_cache', 'comandas_cache', 'transacoes_cache'];
    keys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('✅ Dados de teste limpos');
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
  }
}

// Exportar funções para uso no console
window.testarCriacaoMaterial = testarCriacaoMaterial;
window.testarCriacaoComanda = testarCriacaoComanda;
window.verificarStatusConexao = verificarStatusConexao;
window.limparDadosTeste = limparDadosTeste;

console.log('🚀 Script de teste carregado!');
console.log('📝 Comandos disponíveis:');
console.log('  - testarCriacaoMaterial()');
console.log('  - testarCriacaoComanda()');
console.log('  - verificarStatusConexao()');
console.log('  - limparDadosTeste()');
