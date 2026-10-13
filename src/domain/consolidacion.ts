import type { Entrevista, Evidencia } from './tipos';

/** Divide un texto multilínea en elementos (uno por línea, sin viñetas ni vacíos). */
export function lineas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter((l) => l.length > 0);
}

/**
 * Consolida textos de varias entrevistas en uno solo, una idea por línea,
 * sin duplicados (comparación sin distinguir mayúsculas).
 */
export function consolidarTextos(textos: readonly string[]): string {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const texto of textos) {
    for (const l of lineas(texto)) {
      const clave = l.toLocaleLowerCase('es');
      if (!vistos.has(clave)) {
        vistos.add(clave);
        resultado.push(l);
      }
    }
  }
  return resultado.join('\n');
}

export interface ResumenEvidencias {
  grabaciones: number;
  capturas: number;
  documentos: number;
}

/** Las grabaciones se cuentan en `VU_Entrevistas.UrlGrabacion`; capturas y documentos en la biblioteca. */
export function resumirEvidencias(
  entrevistas: readonly Pick<Entrevista, 'urlGrabacion'>[],
  evidencias: readonly Pick<Evidencia, 'tipo'>[],
): ResumenEvidencias {
  return {
    grabaciones: entrevistas.filter((e) => !!e.urlGrabacion?.trim()).length,
    capturas: evidencias.filter((e) => e.tipo === 'Captura').length,
    documentos: evidencias.filter((e) => e.tipo === 'Documento').length,
  };
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** "3 grabaciones · 7 capturas" (+ " · 1 documento" si hay). */
export function textoEvidencias(r: ResumenEvidencias): string {
  const partes = [plural(r.grabaciones, 'grabación', 'grabaciones'), plural(r.capturas, 'captura', 'capturas')];
  if (r.documentos > 0) partes.push(plural(r.documentos, 'documento', 'documentos'));
  return partes.join(' · ');
}
