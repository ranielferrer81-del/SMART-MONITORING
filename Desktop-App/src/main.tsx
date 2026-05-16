import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initApiBaseUrl } from './config/apiBase';
import { api } from './api/client';

async function bootstrap() {
  const baseUrl = await initApiBaseUrl();
  api.defaults.baseURL = baseUrl;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
