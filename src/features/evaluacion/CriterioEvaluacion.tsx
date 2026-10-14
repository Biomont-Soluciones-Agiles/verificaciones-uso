import { Badge, Button, Field, makeStyles, Text, Textarea, tokens } from '@fluentui/react-components';
import { ArrowUndo16Regular } from '@fluentui/react-icons';
import { aparecer, CURVA_SALIDA, DURACION, fundir, MENOS_MOVIMIENTO } from '../../app/movimiento';
import { ScoreSlider } from '../../components/ScoreSlider';
import { faltaSustento, formatearPuntaje, requiereSustento } from '../../domain/evaluacion';
import type { PuntajeCriterio } from '../../domain/tipos';

const useStyles = makeStyles({
  bloque: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    paddingBlock: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  sugerido: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacingHorizontalS },
  nota: { color: tokens.colorNeutralForeground2, fontVariantNumeric: 'tabular-nums' },
  // Lo que aparece porque el puntaje final se separó del sugerido (RN-05) se asienta en su sitio.
  aparece: {
    animationName: aparecer,
    animationDuration: DURACION.estado,
    animationTimingFunction: CURVA_SALIDA,
    [MENOS_MOVIMIENTO]: { animationName: fundir },
  },
});

export interface CriterioEvaluacionProps {
  puntaje: PuntajeCriterio;
  soloLectura: boolean;
  mostrarErrores: boolean;
  onChange: (cambios: Partial<Pick<PuntajeCriterio, 'puntajeFinal' | 'sustentoAjuste'>>) => void;
}

/** Un criterio: deslizador del puntaje final, sugerido vs. final y sustento obligatorio si difieren (RN-05). */
export function CriterioEvaluacion({ puntaje, soloLectura, mostrarErrores, onChange }: CriterioEvaluacionProps) {
  const styles = useStyles();
  const exige = requiereSustento(puntaje);
  const falta = faltaSustento(puntaje);

  return (
    <div className={styles.bloque}>
      <ScoreSlider
        etiqueta={`${puntaje.titulo} · ${puntaje.peso} %`}
        valor={puntaje.puntajeFinal}
        deshabilitado={soloLectura}
        onChange={(puntajeFinal) => onChange({ puntajeFinal })}
      />
      <div className={styles.sugerido}>
        <Text size={200} className={styles.nota}>
          {puntaje.puntajeSugerido === null
            ? 'Sin sugerencia: ninguna respuesta de entrevistas completas impacta este criterio.'
            : `Sugerido: ${formatearPuntaje(puntaje.puntajeSugerido)} · Final: ${formatearPuntaje(puntaje.puntajeFinal)}`}
        </Text>
        {exige && puntaje.puntajeSugerido !== null && (
          <Badge appearance="outline" color="warning" size="small" className={styles.aparece}>
            Ajustado
          </Badge>
        )}
        {!soloLectura && exige && puntaje.puntajeSugerido !== null && (
          <Button
            size="small"
            appearance="subtle"
            icon={<ArrowUndo16Regular />}
            onClick={() => onChange({ puntajeFinal: puntaje.puntajeSugerido ?? puntaje.puntajeFinal })}
          >
            Usar sugerido
          </Button>
        )}
      </div>
      {exige && (
        <Field
          className={styles.aparece}
          label={`Sustento del ajuste de ${puntaje.titulo}`}
          required
          validationState={falta ? (mostrarErrores ? 'error' : 'warning') : 'none'}
          validationMessage={falta ? 'Obligatorio: el puntaje final difiere del sugerido.' : undefined}
        >
          <Textarea
            rows={2}
            resize="vertical"
            value={puntaje.sustentoAjuste}
            disabled={soloLectura}
            onChange={(_, d) => onChange({ sustentoAjuste: d.value })}
          />
        </Field>
      )}
    </div>
  );
}
