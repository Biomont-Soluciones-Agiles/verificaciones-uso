import { Button, Field, makeStyles, SpinButton, tokens } from '@fluentui/react-components';
import { Checkmark16Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useEntrevistas } from '../data/hooks/useEntrevistas';
import { useCambiarEntrevistasPrevistas } from '../data/hooks/useVerificaciones';
import type { Verificacion } from '../domain/tipos';
import { useAvisos } from './avisos';
import { iconoOcupado } from './iconoOcupado';

const MAXIMO = 20;

const useStyles = makeStyles({
  fila: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  numero: { width: '96px' },
});

export interface CambiarPrevistasProps {
  verificacion: Verificacion;
}

/**
 * "Entrevistas previstas" editable en cualquier etapa antes del envío. No baja de las entrevistas
 * ya registradas; si al aumentarla quedan entrevistas por completar, la verificación vuelve a
 * levantamiento (RN-07) y la evaluación se bloquea hasta completarlas.
 */
export function CambiarPrevistas({ verificacion }: CambiarPrevistasProps) {
  const styles = useStyles();
  const avisos = useAvisos();
  const cambiar = useCambiarEntrevistasPrevistas(verificacion.id);
  const { data: entrevistas = [] } = useEntrevistas(verificacion.id);
  const [valor, setValor] = useState(verificacion.entrevistasPrevistas);
  const minimo = Math.max(1, entrevistas.length);
  const modificado = valor !== verificacion.entrevistasPrevistas;
  const invalido = valor < minimo || valor > MAXIMO;

  const guardar = async () => {
    try {
      const v = await cambiar.mutateAsync(valor);
      avisos.exito(
        v.estado === 'En levantamiento' && verificacion.estado === 'En evaluación'
          ? `Ahora son ${v.entrevistasPrevistas} entrevistas previstas: completa las nuevas para volver a evaluar.`
          : `Entrevistas previstas: ${v.entrevistasPrevistas}.`,
      );
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Field
      label="Entrevistas previstas"
      hint={entrevistas.length > 0 ? `Mínimo ${minimo}: ya hay ${entrevistas.length} registradas.` : `Entre 1 y ${MAXIMO}`}
      validationState={invalido ? 'error' : 'none'}
      validationMessage={invalido ? `Debe estar entre ${minimo} y ${MAXIMO}.` : undefined}
    >
      <div className={styles.fila}>
        <SpinButton
          className={styles.numero}
          min={minimo}
          max={MAXIMO}
          value={valor}
          disabled={cambiar.isPending}
          onChange={(_, d) => {
            const n = d.value ?? Number(d.displayValue);
            if (Number.isFinite(n)) setValor(Math.round(n));
          }}
        />
        {modificado && (
          <>
            <Button
              size="small"
              appearance="primary"
              icon={iconoOcupado(cambiar.isPending, <Checkmark16Regular />)}
              disabled={invalido || cambiar.isPending}
              onClick={guardar}
            >
              {cambiar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              size="small"
              appearance="subtle"
              disabled={cambiar.isPending}
              onClick={() => setValor(verificacion.entrevistasPrevistas)}
            >
              Deshacer
            </Button>
          </>
        )}
      </div>
    </Field>
  );
}
