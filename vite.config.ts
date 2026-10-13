import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { powerApps } from '@microsoft/power-apps-vite/plugin';

// https://vite.dev/config/
export default defineConfig({
  // powerApps(): base './', CORS para el host de Power Apps y URL "Local Play" en consola.
  plugins: [react(), powerApps()],
  server: {
    // Debe coincidir con `localAppUrl` de power.config.json.
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        // Separa las librerías para que el código de la app se cachee de forma independiente.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Griffel (CSS-in-JS) aparte: lo usan tanto los componentes como los iconos (evita ciclos).
          if (id.includes('@griffel')) return 'griffel';
          if (id.includes('@fluentui/react-icons')) return 'fluent-icons';
          if (id.includes('@fluentui') || id.includes('tabster')) return 'fluent';
          if (id.includes('@tanstack')) return 'react-query';
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react';
          }
          return 'vendor';
        },
      },
    },
  },
});
