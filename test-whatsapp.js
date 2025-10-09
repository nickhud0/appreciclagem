// Script de teste para WhatsApp
// Execute no console do navegador (F12)

console.log('🧪 Teste do WhatsApp - App Reciclagem Pereque');

// Função para testar geração de PDF
async function testarGeracaoPDF() {
  console.log('📄 Testando geração de PDF...');
  
  try {
    // Simular dados de comanda para teste
    const comandaTeste = {
      numero: 'TEST-001',
      data: '25/12/2024',
      horario: '14:30',
      tipo: 'venda',
      itens: [
        {
          produto: 'Papel Teste',
          quantidade: 10,
          precoUnitario: 1.50,
          total: 15.00
        },
        {
          produto: 'Plástico Teste',
          quantidade: 5,
          precoUnitario: 2.00,
          total: 10.00
        }
      ],
      total: 25.00
    };
    
    if (typeof window.pdfService !== 'undefined') {
      const pdf = window.pdfService.generateComandaPDF(comandaTeste);
      console.log('✅ PDF gerado com sucesso:', pdf);
      return true;
    } else {
      console.log('❌ pdfService não disponível');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao testar PDF:', error);
    return false;
  }
}

// Função para testar compartilhamento WhatsApp
async function testarWhatsApp() {
  console.log('📱 Testando compartilhamento WhatsApp...');
  
  try {
    const phoneNumber = '11999999999';
    const message = 'Teste de comanda via WhatsApp';
    
    if (typeof window.shareComandaWhatsAppAndroid !== 'undefined') {
      // Simular PDF path
      const pdfPath = 'file:///test/comanda.pdf';
      
      await window.shareComandaWhatsAppAndroid(pdfPath, phoneNumber, message);
      console.log('✅ WhatsApp testado com sucesso');
      return true;
    } else {
      console.log('❌ shareComandaWhatsAppAndroid não disponível');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao testar WhatsApp:', error);
    return false;
  }
}

// Função para testar busca de comanda
async function testarBuscaComanda() {
  console.log('🔍 Testando busca de comanda...');
  
  try {
    if (typeof window.databaseV2Service !== 'undefined') {
      const comandas = await window.databaseV2Service.getComandasRecentes(1);
      console.log('✅ Comandas encontradas:', comandas);
      return comandas.length > 0;
    } else {
      console.log('❌ databaseV2Service não disponível');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar comandas:', error);
    return false;
  }
}

// Função para testar conexão com Supabase
async function testarSupabase() {
  console.log('☁️ Testando conexão Supabase...');
  
  try {
    if (typeof window.supabaseService !== 'undefined') {
      const comandas = await window.supabaseService.getComandas(1);
      console.log('✅ Supabase conectado, comandas:', comandas);
      return true;
    } else {
      console.log('❌ supabaseService não disponível');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao conectar Supabase:', error);
    return false;
  }
}

// Função principal de teste
async function executarTestesWhatsApp() {
  console.log('🚀 Iniciando testes do WhatsApp...');
  
  const resultados = {
    pdf: await testarGeracaoPDF(),
    comanda: await testarBuscaComanda(),
    supabase: await testarSupabase(),
    whatsapp: await testarWhatsApp()
  };
  
  console.log('📊 Resultados dos testes:', resultados);
  
  const sucessos = Object.values(resultados).filter(r => r).length;
  const total = Object.keys(resultados).length;
  
  console.log(`✅ ${sucessos}/${total} testes passaram`);
  
  if (sucessos === total) {
    console.log('🎉 Todos os testes passaram! WhatsApp deve estar funcionando.');
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique os erros acima.');
  }
  
  return resultados;
}

// Função para diagnosticar problema específico
function diagnosticarWhatsApp() {
  console.log('🔧 Diagnosticando problema do WhatsApp...');
  
  const diagnosticos = {
    'Capacitor disponível': typeof window.Capacitor !== 'undefined',
    'Share disponível': typeof window.Share !== 'undefined',
    'Browser disponível': typeof window.Browser !== 'undefined',
    'Filesystem disponível': typeof window.Filesystem !== 'undefined',
    'jsPDF disponível': typeof window.jsPDF !== 'undefined',
    'Plataforma nativa': window.Capacitor?.isNativePlatform?.() || false
  };
  
  console.log('📋 Diagnósticos:', diagnosticos);
  
  const problemas = Object.entries(diagnosticos)
    .filter(([_, status]) => !status)
    .map(([nome, _]) => nome);
  
  if (problemas.length > 0) {
    console.log('❌ Problemas encontrados:', problemas);
  } else {
    console.log('✅ Todos os componentes necessários estão disponíveis');
  }
  
  return diagnosticos;
}

// Exportar funções para uso global
window.testarGeracaoPDF = testarGeracaoPDF;
window.testarWhatsApp = testarWhatsApp;
window.testarBuscaComanda = testarBuscaComanda;
window.testarSupabase = testarSupabase;
window.executarTestesWhatsApp = executarTestesWhatsApp;
window.diagnosticarWhatsApp = diagnosticarWhatsApp;

console.log('✅ Script de teste carregado!');
console.log('📝 Comandos disponíveis:');
console.log('  - executarTestesWhatsApp() - Executa todos os testes');
console.log('  - diagnosticarWhatsApp() - Diagnostica problemas');
console.log('  - testarGeracaoPDF() - Testa geração de PDF');
console.log('  - testarWhatsApp() - Testa compartilhamento');
console.log('  - testarBuscaComanda() - Testa busca de comandas');
console.log('  - testarSupabase() - Testa conexão Supabase');
