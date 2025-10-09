import React from 'react'
import { logger } from '@/utils/logger';
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { initializeDatabase } from './database/initDatabase';
import { initializeSyncEngine, startSyncLoop } from '@/services/syncEngine';

// Registrar service worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        logger.info('SW registered: ', registration);
      })
      .catch((registrationError) => {
        logger.error('SW registration failed: ', registrationError);
      });
  });
}

// Configuração inicial para mobile e database
const initializeMobileFeatures = async () => {
  try {
    // Inicializar banco de dados SQLite
    logger.info('🗄️ Initializing SQLite database...');
    await initializeDatabase();
    logger.info('✅ Database ready for use');
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    // Continue app initialization even if database fails
    // The app can still function in a degraded mode
  }

  // Inicializar sync engine (fica inativo sem credenciais)
  try {
    initializeSyncEngine({ intervalMs: 30000 });
    startSyncLoop();
  } catch (error) {
    logger.warn('Sync engine init failed (will remain idle):', error);
  }

  if (Capacitor.isNativePlatform()) {
    try {
      // Configurar status bar
      await StatusBar.setStyle({ style: Style.Default });
      await StatusBar.setBackgroundColor({ color: '#3b82f6' });
      
      // Ocultar splash screen após carregamento
      await SplashScreen.hide();
    } catch (error) {
      console.warn('Mobile features initialization failed:', error);
    }
  }
};

// Inicializar app
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

// Render with proper React structure
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Inicializar recursos mobile em background
initializeMobileFeatures();
