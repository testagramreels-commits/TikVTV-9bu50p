import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyTheme } from '@/stores/themeStore';

// Apply saved theme BEFORE first render to prevent blank/black flash
try {
  const saved = JSON.parse(localStorage.getItem('tikvtv_theme') || '{}');
  const theme = saved?.state?.theme || 'dark';
  applyTheme(theme);
  document.body.style.backgroundColor = theme === 'light' ? '#f7f7f7' : '#000000';
  document.documentElement.style.backgroundColor = theme === 'light' ? '#f7f7f7' : '#000000';
} catch {
  document.body.style.backgroundColor = '#000000';
  document.documentElement.style.backgroundColor = '#000000';
}

// Register service worker for PWA + offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[SW] Registered:', reg.scope);
      reg.update();
    }).catch(err => {
      console.warn('[SW] Registration failed:', err);
    });
  });
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
