import { Spinner } from '@fluentui/react-components';
import type { ReactElement } from 'react';

/**
 * Icono de un botón que cambia a un spinner mientras su acción está en curso, para que
 * quede claro qué botón se pulsó y que el guardado sigue en marcha.
 */
export function iconoOcupado(ocupado: boolean, icono: ReactElement): ReactElement {
  return ocupado ? <Spinner size="tiny" aria-hidden="true" /> : icono;
}
