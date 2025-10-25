# 🔧 Troubleshooting - PDF no Android

## Problemas Comuns e Soluções

### ❌ Problema: "PDF is of invalid format"

#### Causa Provável:
- Encoding base64 incorreto
- PDF não gerado corretamente

#### Solução:
1. Verifique que fez rebuild completo:
   ```bash
   ./rebuild-android.sh
   ```

2. Limpe cache do Android Studio:
   - File > Invalidate Caches > Invalidate and Restart

3. Teste no navegador primeiro:
   ```bash
   firefox test-pdf-generation.html
   ```
   Se funcionar no navegador mas não no Android, o problema é na configuração do Capacitor.

4. Verifique os logs:
   ```bash
   adb logcat | grep -E "(PDF|Capacitor)"
   ```
   Procure por:
   - `[PDF] PDF gerado com X bytes` - deve mostrar tamanho > 0
   - `[PDF] Arquivo salvo em Downloads` - confirma que salvou
   - Erros de permissão

---

### ❌ Problema: "Permissões negadas"

#### Solução:
1. **No dispositivo Android:**
   - Configurações > Apps > Reciclagem Pereque
   - Permissões > Arquivos e mídia > Permitir

2. **Se não aparecer a opção:**
   - Configurações > Apps > Reciclagem Pereque
   - Permissões > Permitir TODAS

3. **Forçar pedido de permissão:**
   - Desinstale o app
   - Reinstale e teste novamente
   - O app deve pedir permissões na primeira vez

4. **Verificar no código:**
   ```bash
   grep -n "requestPermissions" src/services/pdf/generateComandaA4.ts
   ```
   Deve mostrar a função sendo chamada.

---

### ❌ Problema: "PDF salvo mas não aparece em Downloads"

#### Onde procurar:
1. **Gerenciador de arquivos:**
   - Downloads/
   - Documents/
   - Android/data/com.reciclagem.pereque/files/

2. **Buscar pelo nome:**
   - Abra o gerenciador de arquivos
   - Use a busca: `comanda-`
   - Deve mostrar todos os PDFs gerados

3. **Verificar logs:**
   ```bash
   adb logcat | grep "Arquivo salvo"
   ```
   Mostrará o caminho exato onde foi salvo.

4. **Usar ADB para listar:**
   ```bash
   adb shell ls -la /storage/emulated/0/Download/
   adb shell ls -la /storage/emulated/0/Documents/
   ```

---

### ❌ Problema: "Arquivo salvo com tamanho zero"

#### Causa:
- Problema na conversão base64
- Problema no Capacitor Filesystem

#### Solução:
1. **Verificar no código:**
   ```typescript
   // Em generateComandaA4.ts, deve ter:
   const base64Data = bytesToBase64(pdfBytes);
   // NÃO deve ter:
   const base64Data = await pdfDoc.saveAsBase64();
   ```

2. **Testar conversão manualmente:**
   - Abra `test-pdf-generation.html`
   - Clique em "Gerar PDF de Teste"
   - Verifique se todos os testes passam

3. **Rebuild completo:**
   ```bash
   cd android && ./gradlew clean && cd ..
   rm -rf dist
   npm run build
   npx cap sync android
   ```

---

### ❌ Problema: "Erro ao salvar o PDF"

#### Debug:
1. **Logs detalhados:**
   ```bash
   adb logcat -c  # Limpar logs
   # Clique no botão PDF no app
   adb logcat | grep -A 5 "PreviewComanda"
   ```

2. **Verificar espaço em disco:**
   ```bash
   adb shell df -h /storage/emulated/0/
   ```

3. **Verificar permissões do app:**
   ```bash
   adb shell pm list permissions -g
   adb shell dumpsys package com.reciclagem.pereque | grep -A 5 "permission"
   ```

---

### ❌ Problema: "App crasha ao gerar PDF"

#### Solução:
1. **Verificar erro específico:**
   ```bash
   adb logcat *:E
   ```

2. **Problemas comuns:**
   - **OutOfMemoryError**: PDF muito grande
     - Solução: Reduzir escala do html2canvas (se usar)
   
   - **pdf-lib error**: Dados inválidos
     - Solução: Verificar que os dados da comanda estão corretos
   
   - **Filesystem error**: Sem permissões
     - Solução: Verificar permissões (ver acima)

---

### ❌ Problema: "PDF gerado mas abre em branco"

#### Causa:
- Conteúdo não desenhado corretamente
- Problema com fontes

#### Solução:
1. **Testar no navegador:**
   ```bash
   firefox test-pdf-generation.html
   ```
   Se funcionar, o problema é nos dados passados para a função.

2. **Verificar dados:**
   ```typescript
   console.log('Header:', header);
   console.log('Grouped Itens:', groupedItens);
   console.log('Total:', total);
   ```

3. **Verificar se há itens:**
   - A comanda precisa ter pelo menos 1 item
   - Verificar que `groupedItens` não está vazio

---

## 🔍 Comandos Úteis de Debug

### Ver todos os logs do app:
```bash
adb logcat | grep -E "(PDF|Capacitor|Filesystem|PreviewComanda)"
```

### Ver apenas erros:
```bash
adb logcat *:E
```

### Salvar logs em arquivo:
```bash
adb logcat > logs.txt
# Clique no botão PDF
# Ctrl+C para parar
cat logs.txt | grep -E "(PDF|Capacitor)"
```

### Verificar se o arquivo foi criado:
```bash
adb shell ls -la /storage/emulated/0/Download/comanda-*
```

### Puxar o arquivo para o PC:
```bash
adb pull /storage/emulated/0/Download/comanda-XXX.pdf ./
# Abrir no PC para verificar se está válido
```

### Verificar permissões do app:
```bash
adb shell dumpsys package com.reciclagem.pereque | grep permission
```

---

## 📱 Versões do Android e Comportamento

### Android 10 (API 29) - Android 12 (API 32):
- ✅ Legacy External Storage funciona
- ✅ WRITE_EXTERNAL_STORAGE funciona
- Downloads/ é acessível

### Android 13+ (API 33+):
- ⚠️ Scoped Storage obrigatório
- ⚠️ WRITE_EXTERNAL_STORAGE ignorada
- ✅ READ_MEDIA_* permissões necessárias
- Downloads/ ainda acessível via MediaStore

### Android 14 (API 34+):
- ✅ Mesmas regras do Android 13
- ✅ Capacitor Filesystem gerencia automaticamente

---

## ✅ Checklist de Verificação

Antes de reportar problema, verifique:

- [ ] Fez rebuild completo (`./gradlew clean`)
- [ ] Limpou cache do Android Studio
- [ ] PDF funciona no navegador (`test-pdf-generation.html`)
- [ ] App tem todas as permissões ativadas
- [ ] Logs não mostram erros (`adb logcat`)
- [ ] Arquivo tem tamanho > 0 bytes
- [ ] Comanda tem pelo menos 1 item
- [ ] Espaço em disco suficiente

---

## 🆘 Se Nada Funcionar

1. **Capture os logs completos:**
   ```bash
   adb logcat -c
   # Abra o app e clique em PDF
   adb logcat > problema-pdf.txt
   ```

2. **Verifique o arquivo gerado:**
   ```bash
   adb pull /storage/emulated/0/Download/comanda-XXX.pdf ./
   file comanda-XXX.pdf
   hexdump -C comanda-XXX.pdf | head -n 5
   ```
   Deve mostrar: `%PDF-1.X` no início

3. **Teste alternativo - usar Share API:**
   Se Downloads não funcionar, tente compartilhar:
   ```typescript
   import { Share } from '@capacitor/share';
   
   await Share.share({
     title: 'Comanda',
     text: 'Comanda em PDF',
     url: savedPath,
     dialogTitle: 'Compartilhar Comanda'
   });
   ```

---

**Última atualização:** 25/10/2025  
**Para mais ajuda:** Veja `docs/CORRECAO-PDF-ANDROID.md`

