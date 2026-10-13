import { Tab, TabList } from '@fluentui/react-components';
import { useState } from 'react';
import { Encabezado, Pila } from '../../components/Estructura';
import { AdminCriterios } from './AdminCriterios';
import { AdminPreguntas } from './AdminPreguntas';
import { AdminSoluciones } from './AdminSoluciones';

type Pestana = 'criterios' | 'preguntas' | 'soluciones';

/** Administración del catálogo (vacío detectado en el prototipo, §1.4). */
export function AdminPage() {
  const [pestana, setPestana] = useState<Pestana>('criterios');
  return (
    <Pila>
      <Encabezado
        titulo="Administración"
        subtitulo="Criterios y pesos, preguntas y opciones de respuesta, soluciones y su documentación."
      />
      <TabList selectedValue={pestana} onTabSelect={(_, d) => setPestana(d.value as Pestana)}>
        <Tab value="criterios">Criterios y pesos</Tab>
        <Tab value="preguntas">Preguntas y opciones</Tab>
        <Tab value="soluciones">Soluciones y documentos</Tab>
      </TabList>
      <div role="tabpanel" aria-label={pestana}>
        {pestana === 'criterios' && <AdminCriterios />}
        {pestana === 'preguntas' && <AdminPreguntas />}
        {pestana === 'soluciones' && <AdminSoluciones />}
      </div>
    </Pila>
  );
}
