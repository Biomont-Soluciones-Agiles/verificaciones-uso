import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from '@fluentui/react-components';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: ReactNode;
  /** Texto del botón que confirma (verbo que describe la acción). */
  confirmar: string;
  /** Texto del botón que descarta. Por defecto, "Volver". */
  cancelar?: string;
  /** Acción destructiva: el botón de confirmar no es el primario y el foco inicial va a "cancelar". */
  peligrosa?: boolean;
}

type Confirmar = (opciones: OpcionesConfirmacion) => Promise<boolean>;

const ContextoConfirmacion = createContext<Confirmar | null>(null);

/**
 * Diálogo de confirmación de Fluent UI en lugar de `window.confirm`: es accesible (foco atrapado,
 * Escape cancela), sigue el tema de la app y no depende de que el iframe del host permita modales.
 */
export function ConfirmacionProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmacion | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setOpciones(o);
      }),
    [],
  );

  const responder = (valor: boolean) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setOpciones(null);
  };

  return (
    <ContextoConfirmacion.Provider value={confirmar}>
      {children}
      <Dialog open={opciones !== null} modalType="alert" onOpenChange={(_, d) => !d.open && responder(false)}>
        <DialogSurface>
          {opciones && (
            <DialogBody>
              <DialogTitle>{opciones.titulo}</DialogTitle>
              <DialogContent>{opciones.mensaje}</DialogContent>
              <DialogActions>
                <Button
                  appearance={opciones.peligrosa ? 'primary' : 'secondary'}
                  autoFocus={opciones.peligrosa}
                  onClick={() => responder(false)}
                >
                  {opciones.cancelar ?? 'Volver'}
                </Button>
                <Button appearance={opciones.peligrosa ? 'secondary' : 'primary'} onClick={() => responder(true)}>
                  {opciones.confirmar}
                </Button>
              </DialogActions>
            </DialogBody>
          )}
        </DialogSurface>
      </Dialog>
    </ContextoConfirmacion.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmar(): Confirmar {
  const confirmar = useContext(ContextoConfirmacion);
  if (!confirmar) throw new Error('useConfirmar requiere <ConfirmacionProvider>.');
  return confirmar;
}
