import { useOutletContext } from 'react-router-dom';
import type { Verificacion } from '../domain/tipos';

/** Verificación ya cargada por `VerificacionLayout` para las pantallas hijas. */
export function useVerificacionDeRuta(): Verificacion {
  return useOutletContext<Verificacion>();
}
