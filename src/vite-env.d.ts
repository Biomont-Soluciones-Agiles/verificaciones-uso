/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origen de datos: `mock` (por defecto) o `sharepoint`. */
  readonly VITE_DATA_SOURCE?: 'mock' | 'sharepoint';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
