# ⚡ INÍCIO RÁPIDO - Correção de PDF

## 🎯 O que fazer AGORA

### 1️⃣ Execute este comando:
```bash
./rebuild-android.sh
```

### 2️⃣ No Android Studio quando abrir:
- Build > Clean Project
- Build > Rebuild Project
- Run app (botão ▶️ verde)

### 3️⃣ No dispositivo Android:
- Abra o app
- Vá em "Pré-visualização da Comanda"
- Clique no botão **"PDF"**
- Abra o PDF em Downloads

## ✅ Funcionou?

**SIM** → Problema resolvido! 🎉

**NÃO** → Leia `TROUBLESHOOTING-PDF.md`

---

## 🔧 Se der erro de permissão

No Android:
1. Configurações
2. Apps
3. Reciclagem Pereque
4. Permissões
5. Ativar TODAS

---

## 📱 Onde encontrar o PDF gerado

Gerenciador de Arquivos > **Downloads** > `comanda-XXX.pdf`

ou busque por: `comanda-`

---

## 🆘 Precisa de ajuda?

1. Execute: `adb logcat | grep PDF`
2. Leia: `TROUBLESHOOTING-PDF.md`
3. Verifique: `README-PDF-FIX.md`

---

**RESUMO:**
1. `./rebuild-android.sh`
2. Clean + Rebuild no Android Studio
3. Run app
4. Testar botão PDF

**Pronto!** ✅

