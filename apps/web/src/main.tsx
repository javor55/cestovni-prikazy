import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Home } from './Home.js';
import { TripLayout } from './trip/TripLayout.js';
import './index.css';

// Service worker jen v sestavené aplikaci: umožní ji otevřít i bez připojení.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cesta/:id" element={<Navigate to="kdo" replace />} />
        <Route path="/cesta/:id/:step" element={<TripLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
