import { createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';

/**
 * Tema de Fluent UI con los colores del sitio corporativo de Laboratorios Biomont
 * (https://biomont.com.pe/, hoja `theme_invitro/external/css/style.css`).
 *
 * - Rojo corporativo `#e51200` (franja superior de la cabecera, enlaces del menú) → tono 80,
 *   que Fluent usa como fondo de los botones primarios y texto de marca.
 * - Rojo oscuro `#a70000` (final de los degradados rojos del sitio) → tono 60.
 * - El resto de la rampa se interpola hacia un casi negro (10) y un rosa muy claro (160).
 *
 * Contraste WCAG (AA exige 4.5:1): blanco sobre 80 = 4.75; blanco sobre 70 (hover) = 6.10;
 * 80 sobre blanco = 4.75; 70 sobre 160 (insignias de marca) = 5.62.
 */
export const marcaBiomont: BrandVariants = {
  10: '#1f0300',
  20: '#3a0200',
  30: '#550200',
  40: '#710100',
  50: '#8c0100',
  60: '#a70000',
  70: '#c60900',
  80: '#e51200',
  90: '#e82e1e',
  100: '#ec4a3c',
  110: '#ef665a',
  120: '#f28379',
  130: '#f59f97',
  140: '#f9bbb5',
  150: '#fcd7d3',
  160: '#fff3f1',
};

/** Pila tipográfica: Quicksand (la del sitio) con Segoe UI como respaldo si no carga. */
export const fuenteBase =
  "'Quicksand', 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif";

const base = createLightTheme(marcaBiomont);

/** Azul marino del texto del sitio: 16.7:1 sobre blanco. */
const textoBiomont = '#1b1b35';

export const temaBiomont: Theme = {
  ...base,
  fontFamilyBase: fuenteBase,
  colorNeutralForeground1: textoBiomont,
  colorNeutralForeground1Hover: textoBiomont,
  colorNeutralForeground1Pressed: textoBiomont,
  colorNeutralForeground1Selected: textoBiomont,
  // El sitio usa esquinas muy redondeadas (tarjetas de 1rem, botones en píldora).
  borderRadiusMedium: '6px',
  borderRadiusLarge: '10px',
  borderRadiusXLarge: '16px',
};
