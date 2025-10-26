vou te falar o contexto geral do app sem entrar em muitos detalhes apenas para voce entender um pouco do contexto desse projeto caso seja necessario

Este projeto é um **aplicativo mobile offline-first** construído com:

- **React + TypeScript + Vite**

- **TailwindCSS** (para estilização)

- **Capacitor** (para gerar APK e usar plugins nativos como Filesystem, Browser, etc.)

- **SQLite local** para dados offline

- **Supabase** como backend na nuvem

- Arquitetura offline-first:
  
  - O app sempre lê e exibe dados da **SQLite**
  
  - Um **sync_queue** envia mudanças para o Supabase quando online

- O app funciona como **PWA e APK Android**

- Objetivo principal: manter **alta performance, experiência nativa e uso rápido**

**IMPORTANTE PARA O CURSOR:**

- Não alterar lógica de sincronização offline-first

- Não remover ou mudar tabelas SQLite ou sync_queue

- Não alterar backend Supabase a menos que solicitado

- Qualquer alteração deve manter o app leve, rápido e compatível com o fluxo offline → sync → nuvem


