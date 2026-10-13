import { Badge, type BadgeProps } from '@fluentui/react-components';
import type { EstadoEntrevista, EstadoVerificacion, EstadoVU, DecisionAprobacion } from '../domain/tipos';

type Estado = EstadoVU | EstadoVerificacion | EstadoEntrevista | DecisionAprobacion;

const COLORES: Record<Estado, BadgeProps['color']> = {
  Pendiente: 'informative',
  Programada: 'brand',
  'En proceso': 'warning',
  'En revisión': 'important',
  Vigente: 'success',
  Borrador: 'informative',
  'En levantamiento': 'warning',
  'En evaluación': 'warning',
  Observada: 'danger',
  'Aprobada piloto': 'success',
  Aprobada: 'success',
  Cancelada: 'subtle',
  'En curso': 'brand',
  Completa: 'success',
  Rechazada: 'danger',
};

export interface EstadoBadgeProps {
  estado: Estado;
  /** Texto alternativo (por defecto, el propio estado). */
  texto?: string;
}

export function EstadoBadge({ estado, texto }: EstadoBadgeProps) {
  return (
    <Badge appearance="tint" color={COLORES[estado]} shape="rounded">
      {texto ?? estado}
    </Badge>
  );
}
