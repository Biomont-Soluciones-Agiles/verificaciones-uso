import { SpinButton, type SpinButtonOnChangeData } from '@fluentui/react-components';
import { PUNTAJE_MAXIMO, PUNTAJE_MINIMO, redondear1 } from '../domain/evaluacion';

/** Interpreta el cambio del SpinButton: número válido, `null` si se vació, `undefined` si es inválido. */
function leerValor(d: SpinButtonOnChangeData): number | null | undefined {
  if (d.value !== undefined) return d.value;
  const texto = (d.displayValue ?? '').trim();
  if (texto === '') return null;
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export interface PuntajeInputProps {
  id?: string;
  valor: number | null;
  onChange: (valor: number | null) => void;
  deshabilitado?: boolean;
  placeholder?: string;
}

/** Puntaje de 1 a 10 (admite vacío). Usar dentro de un `<Field>` para la etiqueta. */
export function PuntajeInput({ id, valor, onChange, deshabilitado, placeholder = '1 a 10' }: PuntajeInputProps) {
  return (
    <SpinButton
      id={id}
      min={PUNTAJE_MINIMO}
      max={PUNTAJE_MAXIMO}
      step={1}
      value={valor}
      placeholder={placeholder}
      disabled={deshabilitado}
      onChange={(_, d) => {
        const v = leerValor(d);
        if (v === undefined) return;
        onChange(v === null ? null : redondear1(Math.min(PUNTAJE_MAXIMO, Math.max(PUNTAJE_MINIMO, v))));
      }}
    />
  );
}
