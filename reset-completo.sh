#!/bin/bash

# Script de Reset Completo do App
# Uso: ./reset-completo.sh

set -e

echo "🔧 RESET COMPLETO DO APP - Corrigindo Problemas de Cache"
echo "══════════════════════════════════════════════════════════"
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Limpar node_modules e reinstalar
echo -e "${BLUE}[1/8]${NC} Limpando node_modules..."
rm -rf node_modules package-lock.json
echo -e "${GREEN}✓${NC} node_modules removido"

# 2. Limpar dist
echo -e "${BLUE}[2/8]${NC} Limpando dist..."
rm -rf dist
echo -e "${GREEN}✓${NC} dist removido"

# 3. Limpar build Android
echo -e "${BLUE}[3/8]${NC} Limpando build Android..."
cd android
./gradlew clean
cd ..
echo -e "${GREEN}✓${NC} Build Android limpo"

# 4. Reinstalar dependências
echo -e "${BLUE}[4/8]${NC} Reinstalando dependências..."
npm install
echo -e "${GREEN}✓${NC} Dependências instaladas"

# 5. Build do React
echo -e "${BLUE}[5/8]${NC} Building React app..."
npm run build
echo -e "${GREEN}✓${NC} Build concluído"

# 6. Sync Capacitor
echo -e "${BLUE}[6/8]${NC} Sincronizando Capacitor..."
npx cap sync android
echo -e "${GREEN}✓${NC} Sync concluído"

# 7. Copy assets
echo -e "${BLUE}[7/8]${NC} Copiando assets..."
npx cap copy android
echo -e "${GREEN}✓${NC} Assets copiados"

# 8. Abrir Android Studio
echo -e "${BLUE}[8/8]${NC} Abrindo Android Studio..."
npx cap open android

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Reset Completo Concluído!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Próximos passos no Android Studio:${NC}"
echo "1. Build > Invalidate Caches / Restart"
echo "2. Build > Clean Project"
echo "3. Build > Rebuild Project"
echo "4. DESINSTALE o app do dispositivo (importante!)"
echo "5. Run app (Shift+F10)"
echo ""
echo -e "${YELLOW}IMPORTANTE:${NC}"
echo "• O app será reinstalado do zero"
echo "• O banco de dados será recriado"
echo "• Teste adicionar um item e finalizar comanda"
echo ""

