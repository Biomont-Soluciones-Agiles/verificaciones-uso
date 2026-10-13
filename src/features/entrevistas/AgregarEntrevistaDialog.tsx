import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Select,
} from '@fluentui/react-components';
import { useState } from 'react';
import { useAvisos } from '../../components/avisos';
import { Campos } from '../../components/Estructura';
import { PersonaPicker } from '../../components/PersonaPicker';
import { useAreas } from '../../data/hooks/useCatalogo';
import { useAgregarEntrevista } from '../../data/hooks/useEntrevistas';
import { desdeValorDatetimeLocal } from '../../domain/fechas';
import { MODALIDADES_ENTREVISTA, type Id, type ModalidadEntrevista, type Persona, type Verificacion } from '../../domain/tipos';

export interface AgregarEntrevistaDialogProps {
  verificacion: Verificacion;
  totalActual: number;
  onCerrar: () => void;
  onAgregada: (id: Id) => void;
}

export function AgregarEntrevistaDialog({ verificacion, totalActual, onCerrar, onAgregada }: AgregarEntrevistaDialogProps) {
  const avisos = useAvisos();
  const { data: areas = [] } = useAreas();
  const agregar = useAgregarEntrevista(verificacion.id);
  const [entrevistado, setEntrevistado] = useState<Persona | null>(null);
  const [nombreExterno, setNombreExterno] = useState('');
  const [areaId, setAreaId] = useState<Id | null>(null);
  const [fechaHora, setFechaHora] = useState('');
  const [modalidad, setModalidad] = useState<ModalidadEntrevista>(
    verificacion.modalidad === 'Presencial' ? 'Presencial' : 'Teams',
  );
  const sinNombre = !entrevistado && !nombreExterno.trim();
  const superaPrevistas = totalActual + 1 > verificacion.entrevistasPrevistas;

  const guardar = async () => {
    try {
      const nueva = await agregar.mutateAsync({
        entrevistado,
        entrevistadoNombre: entrevistado?.nombre ?? nombreExterno.trim(),
        areaId,
        fechaHora: desdeValorDatetimeLocal(fechaHora),
        modalidad,
      });
      avisos.exito(
        superaPrevistas
          ? `Entrevista agregada. Las entrevistas previstas pasan a ${totalActual + 1}.`
          : 'Entrevista agregada. No se enviaron notificaciones.',
      );
      onAgregada(nueva.id);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onCerrar()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Agregar entrevista</DialogTitle>
          <DialogContent>
            <Campos>
              <Field label="Persona entrevistada" hint="Usuario de Microsoft 365">
                <PersonaPicker valor={entrevistado} onChange={setEntrevistado} />
              </Field>
              <Field label="Nombre (si es externo)">
                <Input
                  value={nombreExterno}
                  disabled={!!entrevistado}
                  onChange={(_, d) => setNombreExterno(d.value)}
                />
              </Field>
              <Field label="Área">
                <Select value={areaId?.toString() ?? ''} onChange={(_, d) => setAreaId(d.value ? Number(d.value) : null)}>
                  <option value="">Sin área</option>
                  {areas
                    .filter((a) => a.activo)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.titulo}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Fecha y hora">
                <Input type="datetime-local" value={fechaHora} onChange={(_, d) => setFechaHora(d.value)} />
              </Field>
              <Field label="Modalidad">
                <Select value={modalidad} onChange={(_, d) => setModalidad(d.value as ModalidadEntrevista)}>
                  {MODALIDADES_ENTREVISTA.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            </Campos>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button appearance="primary" disabled={sinNombre || agregar.isPending} onClick={guardar}>
              Agregar
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
