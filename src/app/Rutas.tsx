import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from '../features/admin/AdminPage';
import { CatalogoPage } from '../features/catalogo/CatalogoPage';
import { EntrevistasPage } from '../features/entrevistas/EntrevistasPage';
import { EvaluacionPage } from '../features/evaluacion/EvaluacionPage';
import { NuevaProgramacionPage, ProgramacionPage } from '../features/programacion/ProgramacionPage';
import { RevisionPage } from '../features/revision/RevisionPage';
import { ErrorCarga } from '../components/Estructura';
import { Layout } from './Layout';
import { VerificacionLayout } from './VerificacionLayout';

/**
 * HashRouter: la Code App se sirve desde una ruta fija del host de Power Apps,
 * así que la navegación vive en el fragmento (#/catalogo).
 */
export function Rutas() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/catalogo" replace />} />
          <Route path="catalogo" element={<CatalogoPage />} />
          <Route path="programar" element={<NuevaProgramacionPage />} />
          <Route path="verificaciones/:id" element={<VerificacionLayout />}>
            <Route index element={<Navigate to="programacion" replace />} />
            <Route path="programacion" element={<ProgramacionPage />} />
            <Route path="entrevistas" element={<EntrevistasPage />} />
            <Route path="evaluacion" element={<EvaluacionPage />} />
            <Route path="revision" element={<RevisionPage />} />
          </Route>
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<ErrorCarga titulo="Página no encontrada" error={new Error('La ruta no existe.')} />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
