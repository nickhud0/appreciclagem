#!/bin/bash

# Script para verificar se todas as correções foram aplicadas corretamente
# Uso: ./verificar-correcoes.sh

echo "🔍 Verificando correções aplicadas..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

errors=0
warnings=0

# Função para verificar
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        ((errors++))
    fi
}

check_warning() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${YELLOW}⚠${NC} $1"
        ((warnings++))
    fi
}

echo -e "${BLUE}[1] Verificando arquivos modificados...${NC}"
echo ""

# Verificar se generateComandaA4.ts existe e tem a correção
if [ -f "src/services/pdf/generateComandaA4.ts" ]; then
    if grep -q "bytesToBase64(pdfBytes)" "src/services/pdf/generateComandaA4.ts"; then
        echo -e "${GREEN}✓${NC} generateComandaA4.ts - Conversão base64 corrigida"
    else
        echo -e "${RED}✗${NC} generateComandaA4.ts - Conversão base64 não encontrada"
        ((errors++))
    fi
    
    if grep -q "Conversão robusta" "src/services/pdf/generateComandaA4.ts"; then
        echo -e "${GREEN}✓${NC} generateComandaA4.ts - Função bytesToBase64 atualizada"
    else
        echo -e "${RED}✗${NC} generateComandaA4.ts - Função bytesToBase64 não atualizada"
        ((errors++))
    fi
else
    echo -e "${RED}✗${NC} generateComandaA4.ts não encontrado"
    ((errors++))
fi

# Verificar se exportReceipt.ts foi deletado
if [ ! -f "src/services/pdf/exportReceipt.ts" ]; then
    echo -e "${GREEN}✓${NC} exportReceipt.ts deletado (arquivo incorreto removido)"
else
    echo -e "${YELLOW}⚠${NC} exportReceipt.ts ainda existe (deveria ter sido deletado)"
    ((warnings++))
fi

echo ""
echo -e "${BLUE}[2] Verificando AndroidManifest.xml...${NC}"
echo ""

# Verificar AndroidManifest.xml
if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
    if grep -q "requestLegacyExternalStorage" "android/app/src/main/AndroidManifest.xml"; then
        echo -e "${GREEN}✓${NC} AndroidManifest.xml - requestLegacyExternalStorage configurado"
    else
        echo -e "${RED}✗${NC} AndroidManifest.xml - requestLegacyExternalStorage não encontrado"
        ((errors++))
    fi
    
    if grep -q "READ_MEDIA_IMAGES" "android/app/src/main/AndroidManifest.xml"; then
        echo -e "${GREEN}✓${NC} AndroidManifest.xml - Permissões Android 13+ configuradas"
    else
        echo -e "${RED}✗${NC} AndroidManifest.xml - Permissões Android 13+ não encontradas"
        ((errors++))
    fi
else
    echo -e "${RED}✗${NC} AndroidManifest.xml não encontrado"
    ((errors++))
fi

echo ""
echo -e "${BLUE}[3] Verificando PreviewComanda.tsx...${NC}"
echo ""

if [ -f "src/pages/PreviewComanda.tsx" ]; then
    if grep -q "generateAndSaveComandaA4Pdf" "src/pages/PreviewComanda.tsx"; then
        echo -e "${GREEN}✓${NC} PreviewComanda.tsx - Usando função correta de geração de PDF"
    else
        echo -e "${RED}✗${NC} PreviewComanda.tsx - Função de PDF não encontrada"
        ((errors++))
    fi
    
    if grep -q "Gerando PDF..." "src/pages/PreviewComanda.tsx"; then
        echo -e "${GREEN}✓${NC} PreviewComanda.tsx - Feedback melhorado ao usuário"
    else
        echo -e "${YELLOW}⚠${NC} PreviewComanda.tsx - Toast de feedback não encontrado"
        ((warnings++))
    fi
else
    echo -e "${RED}✗${NC} PreviewComanda.tsx não encontrado"
    ((errors++))
fi

echo ""
echo -e "${BLUE}[4] Verificando dependências...${NC}"
echo ""

if [ -f "package.json" ]; then
    if grep -q "pdf-lib" "package.json"; then
        echo -e "${GREEN}✓${NC} package.json - pdf-lib instalado"
    else
        echo -e "${RED}✗${NC} package.json - pdf-lib não encontrado"
        ((errors++))
    fi
    
    if grep -q "@capacitor/filesystem" "package.json"; then
        echo -e "${GREEN}✓${NC} package.json - @capacitor/filesystem instalado"
    else
        echo -e "${RED}✗${NC} package.json - @capacitor/filesystem não encontrado"
        ((errors++))
    fi
else
    echo -e "${RED}✗${NC} package.json não encontrado"
    ((errors++))
fi

echo ""
echo -e "${BLUE}[5] Verificando arquivos de documentação...${NC}"
echo ""

[ -f "docs/CORRECAO-PDF-ANDROID.md" ]
check_warning "docs/CORRECAO-PDF-ANDROID.md criado"

[ -f "CORRECOES-APLICADAS.md" ]
check_warning "CORRECOES-APLICADAS.md criado"

[ -f "rebuild-android.sh" ]
check_warning "rebuild-android.sh criado"

[ -f "test-pdf-generation.html" ]
check_warning "test-pdf-generation.html criado"

echo ""
echo "═══════════════════════════════════════════════"

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}✓ TODAS AS CORREÇÕES APLICADAS COM SUCESSO!${NC}"
    echo ""
    echo -e "${GREEN}Próximo passo:${NC}"
    echo "  ./rebuild-android.sh"
elif [ $errors -eq 0 ]; then
    echo -e "${YELLOW}⚠ Correções principais OK, $warnings avisos${NC}"
    echo ""
    echo -e "${GREEN}Próximo passo:${NC}"
    echo "  ./rebuild-android.sh"
else
    echo -e "${RED}✗ $errors erros encontrados${NC}"
    if [ $warnings -gt 0 ]; then
        echo -e "${YELLOW}⚠ $warnings avisos${NC}"
    fi
    echo ""
    echo -e "${RED}Corrija os erros antes de continuar!${NC}"
    exit 1
fi

echo "═══════════════════════════════════════════════"
echo ""

