#!/bin/bash

# Script para rebuild completo do app Android após correções
# Uso: ./rebuild-android.sh

set -e  # Para em caso de erro

echo "🔧 Iniciando rebuild do app Android..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Limpar build Android anterior
echo -e "${BLUE}[1/6]${NC} Limpando build Android anterior..."
cd android
./gradlew clean
cd ..
echo -e "${GREEN}✓${NC} Build Android limpo"
echo ""

# 2. Limpar dist do React
echo -e "${BLUE}[2/6]${NC} Limpando dist do React..."
rm -rf dist
echo -e "${GREEN}✓${NC} Dist limpo"
echo ""

# 3. Build do projeto React
echo -e "${BLUE}[3/6]${NC} Buildando projeto React..."
npm run build
echo -e "${GREEN}✓${NC} Build React concluído"
echo ""

# 4. Sincronizar com Capacitor
echo -e "${BLUE}[4/6]${NC} Sincronizando com Capacitor..."
npx cap sync android
echo -e "${GREEN}✓${NC} Sync concluído"
echo ""

# 5. Copy assets (garantir que tudo foi copiado)
echo -e "${BLUE}[5/6]${NC} Copiando assets..."
npx cap copy android
echo -e "${GREEN}✓${NC} Assets copiados"
echo ""

# 6. Abrir no Android Studio
echo -e "${BLUE}[6/6]${NC} Abrindo Android Studio..."
npx cap open android

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Rebuild concluído!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Próximos passos no Android Studio:${NC}"
echo "1. Build > Clean Project"
echo "2. Build > Rebuild Project"
echo "3. Run app (Shift+F10)"
echo ""
echo -e "${YELLOW}Para ver logs em tempo real:${NC}"
echo "adb logcat | grep -E '(PDF|Capacitor|Filesystem)'"
echo ""

