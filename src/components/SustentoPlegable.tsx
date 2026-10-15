import { Badge, Button, Field, makeStyles, Textarea, tokens } from '@fluentui/react-components';
import { NotepadEdit16Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { aparecer, CURVA_SALIDA, DURACION, fundir, MENOS_MOVIMIENTO } from '../app/movimiento';

const useStyles = makeStyles({
  boton: { alignSelf: 'flex-start' },
  pendiente: { marginLeft: tokens.spacingHorizontalXS },
  campo: {
    animationName: aparecer,
    animationDuration: DURACION.estado,
    animationTimingFunction: CURVA_SALIDA,
    [MENOS_MOVIMIENTO]: { animationName: fundir },
  },
});

export interface SustentoPlegableProps {
  etiqueta: string;
  valor: string;
  soloLectura: boolean;
  onChange: (valor: string) => void;
  /** RN-05: el sustento es obligatorio (se marca en el botón y en el campo). */
  obligatorio?: boolean;
  /** Abre el campo aunque esté vacío (p. ej. al intentar enviar con el sustento pendiente). */
  forzarAbierto?: boolean;
  validationState?: 'error' | 'warning' | 'none';
  validationMessage?: string;
}

/**
 * Sustento que ocupa espacio solo cuando hace falta: vacío se muestra como un botón
 * "Agregar sustento"; con texto (o al pulsarlo) se despliega el campo y ya no se pliega.
 */
export function SustentoPlegable({
  etiqueta,
  valor,
  soloLectura,
  onChange,
  obligatorio = false,
  forzarAbierto = false,
  validationState = 'none',
  validationMessage,
}: SustentoPlegableProps) {
  const styles = useStyles();
  const [abierto, setAbierto] = useState(false);
  const visible = abierto || forzarAbierto || valor.trim() !== '';

  if (!visible) {
    if (soloLectura) return null;
    return (
      <Button
        className={styles.boton}
        size="small"
        appearance="subtle"
        icon={<NotepadEdit16Regular />}
        aria-expanded={false}
        onClick={() => setAbierto(true)}
      >
        {obligatorio ? `${etiqueta} (obligatorio)` : `Agregar ${etiqueta.toLowerCase()}`}
        {obligatorio && (
          <Badge appearance="tint" color="warning" size="small" className={styles.pendiente}>
            Pendiente
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Field
      className={styles.campo}
      label={etiqueta}
      required={obligatorio}
      validationState={validationState}
      validationMessage={validationMessage}
    >
      <Textarea
        rows={2}
        resize="vertical"
        value={valor}
        disabled={soloLectura}
        // Al desplegarlo a pedido se enfoca para escribir de inmediato.
        autoFocus={abierto && valor === ''}
        onChange={(_, d) => onChange(d.value)}
      />
    </Field>
  );
}
