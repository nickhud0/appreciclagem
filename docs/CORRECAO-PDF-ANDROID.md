# Correção do Problema de PDF Inválido no Android

## Problema Identificado

O app Android estava gerando PDFs que apareciam como "invalid format" ao tentar abrir. Após análise completa, foram identificados os seguintes problemas:

### 1. **Encoding Base64 Incorreto**
- O método `pdfDoc.saveAsBase64()` da biblioteca `pdf-lib` estava gerando base64 com problemas de encoding no Android
- **Solução**: Implementada conversão manual robusta de `Uint8Array` para base64 usando chunks de 8KB

### 2. **Scoped Storage no Android 13+ (API 33+)**
- O app usa `targetSdkVersion = 35` (Android 14), que requer Scoped Storage
- As permissões antigas de storage não funcionam corretamente
- **Solução**: Adicionadas configurações corretas no `AndroidManifest.xml`

### 3. **Arquivo Incorreto `exportReceipt.ts`**
- Esse arquivo estava salvando PNG como PDF (formato inválido)
- **Solução**: Arquivo deletado (não estava sendo usado)

## Correções Aplicadas

### 📁 `src/services/pdf/generateComandaA4.ts`

#### Antes:
```typescript
const base64FromPdfLib = await pdfDoc.saveAsBase64({ dataUri: false, ...saveOpts });
const base64Data = String(base64FromPdfLib).replace(/\s+/g, "");
```

#### Depois:
```typescript
const pdfBytes = await pdfDoc.save(saveOpts);
const base64Data = bytesToBase64(pdfBytes);  // Conversão manual robusta

// Função melhorada:
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192; // 8KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    const chunk = bytes.subarray(i, end);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}
```

**Mudanças:**
- ✅ Conversão manual de bytes para base64 (mais confiável)
- ✅ Validação do header do PDF antes de salvar
- ✅ Validação de leitura após escrita
- ✅ Logs detalhados para debug
- ✅ Tratamento de erros melhorado

### 📁 `android/app/src/main/AndroidManifest.xml`

**Adicionado:**
```xml
<application
    ...
    android:requestLegacyExternalStorage="true">
```

**Permissões atualizadas:**
```xml
<!-- Storage Permissions -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

**Mudanças:**
- ✅ Ativado Legacy External Storage para compatibilidade
- ✅ Permissões de storage limitadas ao Android 12 (maxSdkVersion="32")
- ✅ Adicionadas permissões READ_MEDIA_* para Android 13+

### 📁 `src/pages/PreviewComanda.tsx`

**Mudanças:**
- ✅ Melhorado feedback visual ao usuário (toast messages)
- ✅ Adicionados logs de console para debug
- ✅ Melhor tratamento de erros com mensagens específicas
- ✅ Exibição do nome do arquivo no toast de sucesso

### 🗑️ `src/services/pdf/exportReceipt.ts`

- ❌ **DELETADO** - Arquivo incorreto que salvava PNG como PDF

## Como Testar as Correções

### 1. Rebuild do App Android

```bash
# 1. Limpar build anterior
cd android
./gradlew clean
cd ..

# 2. Rebuild do projeto React
npm run build

# 3. Sincronizar com Capacitor
npx cap sync android

# 4. Abrir no Android Studio
npx cap open android

# 5. No Android Studio:
#    - Build > Clean Project
#    - Build > Rebuild Project
#    - Run app no dispositivo
```

### 2. Testar Geração de PDF

1. Abra o app no Android
2. Navegue até a pré-visualização de uma comanda
3. Clique no botão **"PDF"**
4. Aguarde a mensagem de sucesso
5. Abra o gerenciador de arquivos do Android
6. Vá para a pasta **Downloads**
7. Procure pelo arquivo `comanda-[codigo].pdf`
8. Abra o PDF - deve funcionar corretamente agora!

### 3. Debug (se ainda houver problemas)

Conecte o dispositivo ao computador e execute:

```bash
adb logcat | grep -E "(PDF|Capacitor|Filesystem)"
```

Isso mostrará logs detalhados do processo de geração e salvamento do PDF.

## Verificações Implementadas

O código agora faz as seguintes validações:

1. ✅ **Header do PDF válido** - Verifica bytes `%PDF-` no início
2. ✅ **Base64 não vazio** - Garante que a conversão funcionou
3. ✅ **Arquivo salvo com tamanho > 0** - Confirma que foi escrito
4. ✅ **Leitura do arquivo** - Valida que pode ser lido após salvar
5. ✅ **Logs detalhados** - Facilita identificar problemas

## Logs de Debug

Durante a geração, você verá no console:

```
[PreviewComanda] Iniciando geração de PDF...
[PDF] PDF gerado com X bytes, base64 com Y caracteres
[PDF] WriteFile result: {...}
[PDF] Arquivo salvo em Downloads/comanda-X.pdf com Z bytes
[PDF] Verificação: arquivo lido com sucesso (Y caracteres)
[PreviewComanda] PDF gerado com sucesso: {...}
```

## Possíveis Problemas e Soluções

### Problema: "Permissões negadas"

**Solução:**
1. Vá em Configurações do Android
2. Apps > Reciclagem Pereque > Permissões
3. Ative todas as permissões de Storage/Arquivos

### Problema: PDF ainda inválido

**Verifique:**
1. O app foi completamente reconstruído? (`./gradlew clean`)
2. As permissões foram concedidas no Android?
3. Execute `adb logcat` para ver os logs detalhados
4. Verifique se o arquivo tem tamanho > 0 bytes no gerenciador de arquivos

### Problema: Arquivo não aparece em Downloads

**Solução:**
- O arquivo pode ter sido salvo em Documents
- Procure por `comanda-*.pdf` usando a busca do gerenciador de arquivos
- Verifique os logs para ver qual diretório foi usado

## Tecnologias Utilizadas

- **pdf-lib**: Geração de PDF real em formato A4
- **Capacitor Filesystem**: API nativa para salvar arquivos
- **Android Scoped Storage**: Sistema moderno de arquivos do Android

## Próximos Passos

Se tudo funcionar corretamente:

1. ✅ Remover os `console.log` de produção (opcional)
2. ✅ Adicionar funcionalidade de compartilhar PDF (usar Capacitor Share)
3. ✅ Implementar visualização do PDF no app (usar Capacitor Browser)

---

**Data da Correção:** 25/10/2025  
**Status:** ✅ Correções aplicadas - Pronto para teste

