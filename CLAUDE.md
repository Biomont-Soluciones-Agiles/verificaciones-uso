# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

*Verificación de uso* (VU): a Power Apps **Code App** (React 19 + Vite + TypeScript + Fluent UI v9 + TanStack Query + React Router in hash mode) backed by **Dataverse** tables prefixed `vu_`, plus four Power Automate flows. All code identifiers, comments, docs and UI text are in **Spanish** — keep it that way.

The source of truth is `docs/diseno-verificacion-uso.md`: §1.3 business rules (RN-01…RN-10, cited in code), §2.3 table/column dictionary (logical names are the contract), §2.4/§2.5 state machines, §3.3 flows, §3.4 multi-step operations, §3.6 roles. `infra/dataverse/schema.json` is its declarative translation and the single input for the infra scripts. The root `README.md` is untouched Vite template boilerplate; the real docs are `infra/dataverse/README.md` and `infra/power-automate/README.md`.

## Commands

```bash
npm run dev            # Vite on port 3000 (must match localAppUrl in power.config.json)
npm run build          # tsc -b && vite build
npm run lint           # eslint .
npm test               # vitest run (src/**/*.test.ts, node environment)
npx vitest run src/domain/__tests__/flujo.test.ts   # single file
npx vitest run -t "nombre de la prueba"              # single test by name
```

- **Dataverse data only loads inside the Power Apps host**: open the "Local Play" URL printed by `npm run dev`, not `http://localhost:3000`. For offline work set `VITE_DATA_SOURCE=mock` in `.env.local` (see `.env.example`).
- `vitest.config.ts` is deliberately separate from `vite.config.ts` so tests don't load the `powerApps()` plugin.

Infra (Node 18+, no npm deps; auth via `az login`; default org `https://org4d363b5e.crm2.dynamics.com`, override with `--org` or `DATAVERSE_URL`):

```bash
node infra/dataverse/provision.mjs [--dry-run] [--verbose]   # idempotent schema creation (first run ~15–20 min)
node infra/dataverse/verify.mjs                              # diff environment metadata vs schema.json; exit≠0 on drift
node infra/dataverse/seed.mjs [--demo]                       # idempotent seed data
node infra/dataverse/importar-apps.mjs --file apps.json [--reemplazar] [--dry-run]  # real catalog import
node scripts/smoke-dataverse.mjs                             # READ-ONLY: runs the app's exact OData queries via Web API
python -I infra/power-automate/validar_definiciones.py       # static validation of flow definitions vs §2.3 + schema.json
```

`infra/dataverse/tools/apps_xlsx_a_json.py` produces the `apps.json` for `importar-apps.mjs`; that JSON contains business data and must not be committed.

## Architecture

Layering in `src/` (dependencies flow downward only):

- `app/` — providers (`Providers.tsx`: Fluent, QueryClient, `RepositoriesProvider`), `Rutas.tsx` (HashRouter; the verification wizard lives under `verificaciones/:id/{programacion,entrevistas,evaluacion,revision}` inside `VerificacionLayout` + `Stepper`).
- `features/` — one folder per screen (catalogo, programacion, entrevistas, evaluacion, revision, admin). Use hooks from `data/hooks/`, never repositories directly.
- `domain/` — pure business rules (`flujo.ts` state transitions/validations, `evaluacion.ts` scoring, `fechas.ts`, `codigo.ts`, `consolidacion.ts`) and `tipos.ts` (domain types with Spanish string-literal unions). Most unit tests live here.
- `data/`
  - `repositorios.ts` — per-aggregate repository interfaces in domain types. Two implementations: `mock/` (in-memory, seeded from the prototype) and `dataverse/`. `fuente.ts` picks one from `VITE_DATA_SOURCE` (default `dataverse`); `contexto.ts` exposes `useRepositorios()`.
  - `servicios.ts` — multi-step operations without transactions (§3.4). Each step must be **idempotent/retryable**: create-if-missing, recount instead of increment, regenerate derived values. The app never sends notifications (RN-06) — flows react to `vu_estado` changes.
  - `hooks/` — TanStack Query hooks; keys in `hooks/claves.ts` (invalidating a prefix invalidates children).
  - `dataverse/` — adapters over the generated services:
    - `opciones.ts` maps domain string unions ⇄ Dataverse option-set integers (`100000000`-based). Must stay in sync with `schema.json`.
    - `mapeadores.ts` row ⇄ domain mappers and the per-table `SELECT` lists. **`SELECT` must equal the copy in `scripts/smoke-dataverse.mjs`** — a Vitest test enforces it, so update both.
    - `odata.ts` helpers: lookups are read as `_<col>_value` and written as `"<SchemaName PascalCase>@odata.bind": "/<entitySet>(<guid>)"` (e.g. `vu_SolucionId`); entity set names are in `CONJUNTOS`.
    - `repositoriosDataverse.ts` — the SDK has no `$expand`: lookup names come from `FormattedValue` annotations and user emails from a cached batched `systemuser` query; after create/update the row is re-read with its `$select`.
- `generated/` and `.power/schemas/` — output of the Power Apps CLI "add data source" for Dataverse. Do not hand-edit; regenerate when the schema changes.

Changing the data model touches, in order: `docs/diseno-verificacion-uso.md` §2.3 → `infra/dataverse/schema.json` → `provision.mjs`/`verify.mjs` against the environment → regenerate `src/generated` + `.power/schemas` → `domain/tipos.ts`, `dataverse/opciones.ts`, `dataverse/mapeadores.ts` (+ smoke script `SELECT`) → mock repos → flow definitions if they read the column (re-run `validar_definiciones.py`).

### Power Automate flows (`infra/power-automate/F1…F4`)

`definition.json` files are solution-flow `clientdata`; they are not deployed by any script. F2 (review/approvals) and F3 (solution state recalculation) trigger on `vu_verificacion` with **filtering column `vu_estado`**, so only state changes fire flows — the app should send `vu_estado` only when it actually changes. Date-only columns use Lima time (`SA Pacific Standard Time`). Use `UpdateOnlyRecord`, not `UpdateRecord` (upsert). See that README for conventions and known design gaps.

## Dataverse gotchas

- `ApplicationRequired` is enforced by the app/forms, not the Web API; integer columns can't have defaults in Dataverse (the app/seed sets `vu_periodicidadmeses = 6`, `vu_entrevistascompletas = 0`).
- `vu_verificacion.vu_name` is autonumbered (`VU-{SEQNUM:5}`); never set it from the app.
- `vu_evidencia.vu_archivo` (file column, 32 MB) is uploaded after the row is created.
- `vu_puntajecriterio` has alternate key (verificación, criterio) preventing duplicate score rows.
- `provision.mjs` only creates what's missing; it never modifies existing components — use `verify.mjs` to detect drift.
