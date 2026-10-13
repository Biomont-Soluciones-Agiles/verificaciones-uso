import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

// El SDK @microsoft/power-apps (v1.x) no requiere inicialización explícita: los servicios
// generados y getContext() se comunican con el host de Power Apps bajo demanda. Fuera del
// host (npm run dev en el navegador) la app funciona con VITE_DATA_SOURCE=mock.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
