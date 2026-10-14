---
name: Verificación de uso
description: Herramienta interna de Laboratorios Biomont para verificar el uso de sus soluciones digitales.
colors:
  rojo-corporativo: "#e51200"
  rojo-corporativo-hover: "#c60900"
  rojo-oxido: "#a70000"
  rojo-pulsado: "#710100"
  velo-rosado: "#fff3f1"
  tinta-noche: "#1b1b35"
  papel-claro: "#fafafa"
  superficie: "#ffffff"
  tinta-secundaria: "#424242"
  tinta-terciaria: "#616161"
  linea-divisoria: "#e0e0e0"
  linea-campo: "#d1d1d1"
  verde-completado: "#107c10"
typography:
  title:
    fontFamily: "Quicksand, Segoe UI, Segoe UI Web (West European), -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
  headline:
    fontFamily: "Quicksand, Segoe UI, Segoe UI Web (West European), -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "28px"
  subtitle:
    fontFamily: "Quicksand, Segoe UI, Segoe UI Web (West European), -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "Quicksand, Segoe UI, Segoe UI Web (West European), -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Quicksand, Segoe UI, Segoe UI Web (West European), -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  numero-destacado:
    fontFamily: "Quicksand, Segoe UI, Segoe UI Web (West European), -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: "52px"
    fontFeature: "tnum"
rounded:
  sm: "2px"
  md: "6px"
  lg: "10px"
  xl: "16px"
  pill: "10000px"
spacing:
  xxs: "2px"
  xs: "4px"
  s: "8px"
  m: "12px"
  l: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.rojo-corporativo}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.md}"
    padding: "5px 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.rojo-corporativo-hover}"
    textColor: "{colors.superficie}"
  button-primary-pressed:
    backgroundColor: "{colors.rojo-pulsado}"
    textColor: "{colors.superficie}"
  button-subtle:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-noche}"
    rounded: "{rounded.md}"
    padding: "5px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-noche}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.rojo-corporativo}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.pill}"
  franja-marca:
    backgroundColor: "{colors.rojo-corporativo}"
    textColor: "{colors.superficie}"
    typography: "{typography.headline}"
    padding: "12px 20px"
  card:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta-noche}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  stepper-paso-actual:
    backgroundColor: "{colors.velo-rosado}"
    textColor: "{colors.tinta-noche}"
    rounded: "{rounded.md}"
    padding: "8px"
  badge-estado:
    rounded: "{rounded.md}"
    typography: "{typography.label}"
    padding: "0 6px"
---

# Design System: Verificación de uso

## Overview

**Creative North Star: "El Cuaderno de Laboratorio"**

Un laboratorio farmacéutico confía en lo que está registrado: cada dato en su casilla, con fecha, firma y sustento. La app se comporta como ese cuaderno. La página es papel claro y ordenado, la tinta es azul noche, y el **rojo corporativo** de Biomont aparece solo donde algo exige atención o acción: la franja de la cabecera, la acción principal de cada zona, el paso actual del proceso. Nada es decorativo; todo se puede leer de un vistazo y justificar después.

Es una herramienta de **operación**, no de persuasión. Se usa en escritorio durante una llamada de Teams y en el celular en planta, así que la densidad es moderada: campos agrupados en tarjetas blancas sobre fondo gris claro, jerarquía tipográfica corta y estados explícitos con icono y texto. La identidad de Biomont vive en los detalles precisos: el rojo, las esquinas suaves y la navegación en píldora del sitio corporativo. No se usan el logotipo ni imágenes del sitio.

El sistema está construido sobre **Fluent UI v9** con un tema propio (`src/app/tema.ts`). Todo color, espacio y radio sale de los tokens del tema; ningún componente repite un hex.

**Key Characteristics:**
- Fondo de papel claro, tarjetas blancas y una sola tinta de marca: el rojo corporativo.
- Cabecera en dos niveles: franja roja con el nombre de la herramienta y barra de navegación blanca con sombra.
- Estados de la verificación siempre como insignia con texto; el resultado del índice con icono, texto y color.
- Números tabulares y alineados: el índice, los puntajes y las fechas se comparan en columna.
- Adaptable: a 640 px las rejillas pasan a una columna y la navegación se desplaza en horizontal.

## Colors

Una paleta casi monocroma de papel y tinta, con un único acento: el rojo de Biomont en su rampa de 16 tonos.

### Primary
- **Rojo Corporativo** (#e51200): el rojo del sitio biomont.com.pe. Fondo de la franja de la cabecera, de los botones primarios y del ítem activo de la navegación; borde del paso actual del stepper. Blanco encima: 4.75:1.
- **Rojo Corporativo Hover** (#c60900): estado hover del primario y color de los enlaces y del texto de marca sobre blanco (6.10:1).
- **Rojo Óxido** (#a70000): estado seleccionado; el final de los degradados rojos del sitio.
- **Rojo Pulsado** (#710100): estado pressed del primario.
- **Velo Rosado** (#fff3f1): fondo del paso actual del stepper y de las insignias de marca. Nunca lleva texto rojo corporativo encima (4.38:1, no cumple AA); usa tinta noche o rojo hover.

### Neutral
- **Tinta Noche** (#1b1b35): el azul marino del texto del sitio. Todo el texto principal (16.74:1 sobre blanco).
- **Tinta Secundaria** (#424242): subtítulos, etiquetas de resumen y texto de apoyo.
- **Tinta Terciaria** (#616161): iconos de estados vacíos, ayudas y metadatos.
- **Papel Claro** (#fafafa): fondo de la página detrás de las tarjetas.
- **Superficie** (#ffffff): tarjetas, campos, barra de navegación y stepper.
- **Línea Divisoria** (#e0e0e0): separadores entre filas de resumen y bajo la barra de navegación.
- **Línea de Campo** (#d1d1d1): contorno de los campos, de los marcadores de paso y borde discontinuo de los estados vacíos.

### Tertiary
- **Verde Completado** (#107c10): solo para lo terminado: marcador de etapa completada del stepper. Los demás estados usan los colores semánticos de Fluent en las insignias (éxito, advertencia, peligro, informativo).

### Named Rules
**La Regla de la Tinta Roja.** El rojo corporativo marca lo que pide acción o atención: un solo botón primario por zona, el ítem activo de la navegación y el paso actual. Si dos cosas rojas compiten en la misma tarjeta, una de ellas está mal.

**La Regla del Rojo que no es Error.** El rojo de marca y el rojo de peligro de Fluent son vecinos. Un error o un estado negativo (*Observada*, *Rechazada*, *Adopción baja*) siempre lleva icono y texto, nunca solo color.

## Typography

**Body Font:** Quicksand (con Segoe UI como respaldo)
**Display Font:** la misma familia; la jerarquía se hace con tamaño y peso, no con otra fuente.

**Character:** Quicksand es la tipografía redondeada del sitio de Biomont: amable, legible y técnica a la vez. Dentro del host de Power Apps la política de seguridad bloquea Google Fonts, así que en la práctica se ve **Segoe UI**; el sistema debe funcionar igual de bien con ambas.

### Hierarchy
- **Title** (600, 24px, 32px): título de cada pantalla (`h2`), con `text-wrap: balance`.
- **Headline** (700, 20px, 28px): el nombre "Verificación de uso" en la franja roja (`h1`) y el encabezado del editor de entrevistas.
- **Subtitle** (600, 16px, 22px): títulos de tarjetas y secciones (`h3`).
- **Body** (400, 14px, 20px): todo el texto de trabajo, campos y tablas. Los textos explicativos se limitan a 72ch y los de estados vacíos a 52ch.
- **Label** (400, 12px, 16px): ayudas, metadatos, correos bajo un nombre e insignias.
- **Número destacado** (600, 40px, 52px, cifras tabulares): solo el índice de adopción.

### Named Rules
**La Regla de la Cifra en Columna.** Todo número que se compara (índice, puntajes, fechas, valores de resumen) usa cifras tabulares (`font-variant-numeric: tabular-nums`) y se alinea a la derecha.

## Layout

- **Contenedor** de 1200 px como máximo, centrado, con 20 px de margen lateral (16 px en móvil) y 20 px arriba.
- **Pila vertical** de bloques con 12 px de separación. Dentro de una tarjeta, 12 px entre grupos y 16 px de relleno.
- **Formularios** en dos columnas de campos con 12 px de separación; a 640 px pasan a una.
- **Pantallas con panel lateral** (lista + editor): rejilla 1.15fr / 0.85fr con mínimo de 260 px en el panel; a 760 px se apilan.
- **Acciones** alineadas a la derecha al pie de cada tarjeta, con 8 px entre botones.
- **Cabecera fija** al desplazar en escritorio; en móvil vuelve a ser estática para no robar altura.
- **Stepper** en 5 columnas iguales; a 640 px los pasos se vuelven compactos (número arriba, texto debajo) y solo el paso actual muestra su nombre.
- **Puntos de corte:** 640 px (el principal), 760 px y 860 px.

## Elevation & Depth

Sistema plano con elevación mínima. La profundidad la da el contraste entre el papel claro de la página y las tarjetas blancas; las sombras son discretas y estructurales, nunca decorativas.

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 0 2px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.14)`): el contenedor del stepper.
- **Cabecera** (`box-shadow: 0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)`): la cabecera fija, las tarjetas y el indicador del índice; separa lo que se apoya sobre el papel.
- **Flotante** (`box-shadow: 0 0 2px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.14)`): el enlace "Saltar al contenido" cuando recibe el foco.

### Named Rules
**La Regla de las Tres Alturas.** Solo existen tres niveles de sombra (reposo, cabecera y flotante). Los diálogos y menús usan los de Fluent; no se inventan sombras nuevas.

## Shapes

Esquinas suaves heredadas del sitio corporativo, pero contenidas para una herramienta de trabajo: 6 px en botones, campos y tarjetas; 10 px en contenedores grandes (stepper, indicador del índice, estados vacíos); 16 px como máximo. La **píldora** completa queda reservada a la navegación principal y a los marcadores circulares de los pasos. Las insignias de estado usan la misma esquina de 6 px que los botones. Los estados vacíos se dibujan con borde discontinuo de 1 px.

## Components

### Buttons
Amables y precisos: forma suave, jerarquía estricta.
- **Shape:** esquina suave (6 px); en la navegación, píldora completa.
- **Primary:** rojo corporativo con texto blanco, 32 px de alto. Uno por zona: guardar, programar, enviar a revisión.
- **Hover / Pressed:** rojo hover (#c60900) y rojo pulsado (#710100). El foco usa el anillo de Fluent.
- **Subtle:** transparente con texto tinta noche; para acciones secundarias, de tabla y de navegación inactiva.
- **Ocupado:** el botón pulsado muestra un spinner y su texto cambia a la acción en curso ("Guardando…").

### Chips (insignias de estado)
- **Style:** insignia `tint` de Fluent con esquina de 6 px y texto de 12 px.
- **State:** el color depende del estado (`EstadoBadge`): informativo para pendiente o borrador, marca para programada o en curso, advertencia para en proceso, peligro para observada o rechazada, éxito para aprobada o completa. El texto del estado siempre es visible.

### Cards / Containers
- **Corner Style:** 6 px (tarjeta de Fluent); 10 px en contenedores grandes.
- **Background:** superficie blanca sobre papel claro.
- **Shadow Strategy:** sombra de cabecera (nivel 4 de Fluent); ver Elevation & Depth.
- **Internal Padding:** 16 px, con 12 px entre grupos.

### Inputs / Fields
- **Style:** campos de Fluent con contorno línea de campo (#d1d1d1), fondo blanco, 32 px de alto y esquina de 6 px; siempre dentro de un `Field` con etiqueta visible.
- **Focus:** subrayado de acento de Fluent en el color de marca.
- **Error / Warning:** mensaje de validación del `Field` con icono; un puntaje obligatorio vacío se marca como advertencia.

### Navigation
- **Style:** cabecera en dos niveles. Arriba, la franja roja con el nombre de la herramienta (headline, blanco) y el subtítulo "Soluciones digitales"; a la derecha, la insignia de la verificación activa. Abajo, la barra blanca con botones en píldora e icono: el activo en rojo corporativo, los demás *subtle*; los no disponibles quedan deshabilitados pero enfocables, con tooltip.
- **Mobile:** la barra se desplaza en horizontal en una sola fila y la cabecera deja de ser fija.

### Indicador del índice (componente propio)
Tarjeta blanca de 10 px de radio con sombra de cabecera: la etiqueta ("Índice de adopción" o "Índice preliminar") en 12 px, el número en 40 px con cifras tabulares, y debajo el resultado con icono y texto (verde para plena, ámbar para parcial, rojo para baja). Se anuncia a lectores de pantalla cuando cambia.

### Stepper (componente propio)
Cinco etapas de la verificación en un contenedor blanco: marcador circular numerado de 24 px, con check verde al completar y fondo rojo en la etapa actual; la etapa actual lleva fondo velo rosado y borde inferior rojo de 3 px. Cada paso tiene su `aria-label` "Paso N de 5".

## Do's and Don'ts

### Do:
- **Do** tomar todo color, espacio, radio y sombra de los tokens del tema (`tokens.*` de Fluent con `temaBiomont`); el único color fijo permitido está en `src/app/tema.ts`.
- **Do** acompañar cada estado y cada resultado con texto (y con icono cuando es positivo o negativo).
- **Do** usar cifras tabulares alineadas a la derecha para índices, puntajes y fechas.
- **Do** mantener un solo botón primario rojo por zona y dejar el resto en *subtle* o secundario.
- **Do** probar cada pantalla a 640 px: una columna, navegación desplazable y botones que no se desbordan.

### Don't:
- **Don't** poner texto rojo corporativo sobre velo rosado (4.38:1); usa tinta noche o rojo hover.
- **Don't** usar el rojo como única señal de un error o de un resultado negativo.
- **Don't** depender de Quicksand para que algo se lea bien: dentro de Power Apps se ve Segoe UI.
- **Don't** introducir una segunda familia tipográfica ni sombras fuera de las tres alturas.
- **Don't** incrustar el logotipo ni imágenes del sitio corporativo en la cabecera: la marca se expresa con color y texto.
