import { Combobox, Option, Text, tokens } from '@fluentui/react-components';
import { useState } from 'react';
import { usePersonas, type OrigenPersonas } from '../data/hooks/useCatalogo';
import type { Persona } from '../domain/tipos';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PersonaPickerProps {
  id?: string;
  valor: Persona | null;
  onChange: (persona: Persona | null) => void;
  deshabilitado?: boolean;
  placeholder?: string;
  /**
   * `responsables`: solo usuarios con el rol "VU Responsable" y sin correos escritos a mano
   * (un correo libre no garantiza el rol). Por defecto, todo el directorio.
   */
  origen?: OrigenPersonas;
}

/**
 * Selector de personas. En modo mock usa el directorio de ejemplo; con Dataverse, los usuarios
 * habilitados del entorno (`systemuser`). También se puede escribir un correo: al guardar se
 * busca el usuario por correo y, si es una búsqueda obligatoria y no existe, se avisa.
 * Con `origen="responsables"` solo ofrece (y solo acepta) a quienes tienen el rol "VU Responsable".
 * Usar dentro de un `<Field>` para la etiqueta.
 */
export function PersonaPicker({ id, valor, onChange, deshabilitado, placeholder, origen = 'directorio' }: PersonaPickerProps) {
  const { data: personas = [], isSuccess } = usePersonas(origen);
  const admiteCorreoLibre = origen === 'directorio';
  const [texto, setTexto] = useState(valor?.nombre ?? '');
  const t = texto.trim().toLocaleLowerCase('es');
  const filtradas = personas.filter(
    (p) => !t || p.nombre.toLocaleLowerCase('es').includes(t) || p.email.toLocaleLowerCase().includes(t),
  );

  const confirmarTextoLibre = () => {
    const limpio = texto.trim();
    if (!limpio) {
      if (valor) onChange(null);
      return;
    }
    if (valor && (limpio === valor.nombre || limpio === valor.email)) return;
    const exacta = personas.find((p) => p.nombre === limpio || p.email === limpio);
    if (exacta) onChange(exacta);
    else if (admiteCorreoLibre && RE_EMAIL.test(limpio)) onChange({ email: limpio, nombre: limpio });
    else setTexto(valor?.nombre ?? '');
  };

  return (
    <Combobox
      id={id}
      freeform
      disabled={deshabilitado}
      placeholder={placeholder ?? 'Buscar por nombre o correo'}
      value={texto}
      selectedOptions={valor ? [valor.email] : []}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmarTextoLibre}
      onOptionSelect={(_, d) => {
        const persona = personas.find((p) => p.email === d.optionValue);
        if (persona) {
          setTexto(persona.nombre);
          onChange(persona);
        }
      }}
    >
      {filtradas.map((p) => (
        <Option key={p.email} value={p.email} text={p.nombre}>
          <span>
            {p.nombre}
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {p.email}
            </Text>
          </span>
        </Option>
      ))}
      {isSuccess && filtradas.length === 0 && (
        <Option disabled value="" text="">
          {personas.length === 0 && origen === 'responsables'
            ? 'Nadie tiene todavía el rol VU Responsable en este entorno.'
            : 'Sin coincidencias.'}
        </Option>
      )}
    </Combobox>
  );
}
