import { Button, makeStyles, mergeClasses, Text, tokens } from '@fluentui/react-components';
import { PersonAdd24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { CambiarPrevistas } from '../../components/CambiarPrevistas';
import { EstadoBadge } from '../../components/EstadoBadge';
import { Tarjeta } from '../../components/Estructura';
import { ProgressBar } from '../../components/ProgressBar';
import { contarCompletas } from '../../domain/flujo';
import { formatearDiaMes } from '../../domain/fechas';
import type { Entrevista, EstadoEntrevista, Id, Verificacion } from '../../domain/tipos';
import { AgregarEntrevistaDialog } from './AgregarEntrevistaDialog';

const useStyles = makeStyles({
  lista: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS, listStyle: 'none', margin: 0, padding: 0 },
  item: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    padding: tokens.spacingVerticalS,
    border: 'none',
    borderRadius: tokens.borderRadiusMedium,
    background: 'transparent',
    color: tokens.colorNeutralForeground1,
    textAlign: 'left',
    fontFamily: 'inherit',
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  seleccionado: { backgroundColor: tokens.colorSubtleBackgroundSelected },
  punto: { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: tokens.colorNeutralStroke1 },
  completa: { backgroundColor: tokens.colorPaletteGreenBackground3 },
  enCurso: { backgroundColor: tokens.colorBrandBackground },
  texto: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  detalle: { color: tokens.colorNeutralForeground3 },
});

export interface ListaEntrevistasProps {
  verificacion: Verificacion;
  entrevistas: Entrevista[];
  seleccionadaId: Id | null;
  onSeleccionar: (id: Id) => void;
  editable: boolean;
}

function Punto({ estado }: { estado: EstadoEntrevista }) {
  const styles = useStyles();
  return (
    <span
      aria-hidden="true"
      className={mergeClasses(
        styles.punto,
        estado === 'Completa' && styles.completa,
        estado === 'En curso' && styles.enCurso,
      )}
    />
  );
}

export function ListaEntrevistas({ verificacion, entrevistas, seleccionadaId, onSeleccionar, editable }: ListaEntrevistasProps) {
  const styles = useStyles();
  const [agregando, setAgregando] = useState(false);

  return (
    <Tarjeta>
      <ProgressBar completas={contarCompletas(entrevistas)} previstas={verificacion.entrevistasPrevistas} />
      {editable && <CambiarPrevistas key={verificacion.entrevistasPrevistas} verificacion={verificacion} />}
      <ul className={styles.lista} aria-label="Entrevistas">
        {entrevistas.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className={mergeClasses(styles.item, e.id === seleccionadaId && styles.seleccionado)}
              aria-current={e.id === seleccionadaId ? 'true' : undefined}
              onClick={() => onSeleccionar(e.id)}
            >
              <Punto estado={e.estado} />
              <span className={styles.texto}>
                <Text weight="semibold">{e.entrevistadoNombre}</Text>
                <Text size={200} className={styles.detalle}>
                  {[e.areaNombre, e.fechaHora ? formatearDiaMes(e.fechaHora) : 'sin fecha'].filter(Boolean).join(' · ')}
                </Text>
              </span>
              <EstadoBadge estado={e.estado} />
            </button>
          </li>
        ))}
      </ul>
      {editable && (
        <Button icon={<PersonAdd24Regular />} onClick={() => setAgregando(true)}>
          Agregar entrevista
        </Button>
      )}
      {agregando && (
        <AgregarEntrevistaDialog
          verificacion={verificacion}
          totalActual={entrevistas.length}
          onCerrar={() => setAgregando(false)}
          onAgregada={(id) => {
            setAgregando(false);
            onSeleccionar(id);
          }}
        />
      )}
    </Tarjeta>
  );
}
