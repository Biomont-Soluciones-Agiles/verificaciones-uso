import { Toast, ToastBody, ToastTitle, useToastController, type ToastIntent } from '@fluentui/react-components';
import { createElement } from 'react';
import { mensajeDeError } from '../data/errores';

export const TOASTER_ID = 'vu-avisos';

/** Mensajes estándar (RN-06: guardar nunca notifica). */
export const MENSAJES = {
  borradorGuardado: 'Borrador guardado. No se enviaron notificaciones.',
} as const;

export interface Avisos {
  exito(mensaje: string): void;
  info(mensaje: string): void;
  error(error: unknown, titulo?: string): void;
}

/** Avisos tipo toast sobre el `<Toaster>` global de Fluent UI. */
export function useAvisos(): Avisos {
  const { dispatchToast } = useToastController(TOASTER_ID);
  const mostrar = (intent: ToastIntent, titulo: string, cuerpo?: string) =>
    dispatchToast(
      createElement(
        Toast,
        null,
        createElement(ToastTitle, null, titulo),
        cuerpo ? createElement(ToastBody, null, cuerpo) : null,
      ),
      { intent, timeout: intent === 'error' ? 6000 : 3200, politeness: intent === 'error' ? 'assertive' : 'polite' },
    );
  return {
    exito: (mensaje) => mostrar('success', mensaje),
    info: (mensaje) => mostrar('info', mensaje),
    error: (error, titulo = 'No se pudo completar la acción') => mostrar('error', titulo, mensajeDeError(error)),
  };
}
