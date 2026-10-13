import { defineConfig } from 'vitest/config';

// Configuración de pruebas separada de vite.config.ts para no cargar el plugin de Power Apps
// (que necesita power.config.json y un servidor de desarrollo) al ejecutar Vitest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
