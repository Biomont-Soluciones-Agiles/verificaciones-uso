/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origen de datos: `dataverse` (por defecto) o `mock`. */
  readonly VITE_DATA_SOURCE?: 'dataverse' | 'mock';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
