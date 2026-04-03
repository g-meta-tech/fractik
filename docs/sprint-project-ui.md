# Context Package: Sprint Project UI
# Fractik - Project Core UI & Product Hierarchy Navigation

> **Sprint:** Project UI
> **Objetivo:** Construir las páginas principales de gestión de proyecto: crear proyecto, project detail con tabs, árbol de producto navegable, y CRUD de capabilities/features. Es el sprint que convierte Fractik de "solo MCP" a una app web funcional.
> **Fecha:** 2026-04-02
> **Prerequisito:** Sprint Core + MCP Expansion completados. Backend tiene 31 MCP tools. Frontend tiene dashboard con cards, sidebar, auth con Clerk.
> **Repo:** https://github.com/g-meta-tech/fractik

---

## Paso 0: Crear sprint y asignar items en Fractik

Antes de implementar, registrar el sprint en Fractik via MCP:

```
1. create_sprint(projectSlug: "fractik", name: "Sprint Project UI", startDate: "2026-04-03", endDate: "2026-04-10")
   → Guarda el sprintId retornado

2. add_sprint_item(sprintId: "<sprintId>", entityType: "spec", entityId: "kh74mwzarh99k4m6y6d3cr1zz9842gy5")  // FE-004: Project Detail View
3. add_sprint_item(sprintId: "<sprintId>", entityType: "spec", entityId: "kh70namsvgjrm0zz5r1nsdhrms842xqk")  // FE-005: Vision Editor
4. add_sprint_item(sprintId: "<sprintId>", entityType: "spec", entityId: "kh74e5x9xjqag1bbk0tdbv8b1h843pbt")  // FE-006: Project Settings
5. add_sprint_item(sprintId: "<sprintId>", entityType: "spec", entityId: "kh715smx1k4pjf9cq7cp0ph67n842snr")  // FE-007: Capability Management UI
6. add_sprint_item(sprintId: "<sprintId>", entityType: "spec", entityId: "kh7fcpwt27hz9g58aj008ptdt58421sk")  // FE-008: Feature Detail View
```

Después de implementar cada spec, actualizar su status:
```
update_spec_status(specId: "<specId>", status: "implemented")
add_log_entry(sprintId: "<sprintId>", type: "progress", content: "Implemented FE-XXX: ...")
```

---

## Estado actual del frontend

### Implementado
- Landing page, sign-in/sign-up (Clerk)
- Dashboard con grid de ProjectCards (lee de `api.projects.listByOrg`)
- Project detail page básica (`/projects/[slug]`) — muestra nombre, descripción, vision, metadata
- Sidebar colapsable con org switcher, lista de proyectos, theme toggle
- Mobile sidebar con drawer
- 14 componentes shadcn instalados (button, card, dialog, dropdown-menu, input, label, badge, etc.)

### NO implementado (scope de este sprint)
- Crear proyecto (botón existe pero está disabled)
- Editar proyecto
- Vista de capabilities/features bajo un proyecto
- Tree view del producto
- CRUD de capabilities
- CRUD de features con ACs
- Navegación entre project > capability > feature

---

## Reglas del proyecto

- pnpm only. TypeScript strict. No `any`.
- Archivos kebab-case, componentes PascalCase named export.
- Convex queries via `useQuery(api.module.func)`, mutations via `useMutation(api.module.func)`.
- Multi-tenancy: toda query/mutation ya valida orgId server-side via getAuthUser().
- UI en español.
- Shadcn + Tailwind. Dark/light mode ya funciona.
- Responsive: mobile-first, breakpoints sm/md/lg/xl.
- App Router: `app/(authenticated)/` para rutas protegidas.

---

## Convex functions disponibles (ya implementadas)

### Queries
- `api.projects.listByOrg` — lista proyectos de la org
- `api.projects.getBySlug` — proyecto por slug
- `api.projects.get` — proyecto por ID
- `api.projects.listWithMetrics` — proyectos con counts (caps, features, specs, tests, coverage%)
- `api.capabilities.listByProject` — capabilities de un proyecto (sorted by sortOrder)
- `api.features.listByCapability` — features de una capability (sorted by sortOrder)
- `api.userStories.listByFeature` — stories de un feature
- `api.specs.listByFeature` — specs de un feature (si existe, verificar)
- `api.testCases.listBySpec` — tests de un spec

### Mutations
- `api.projects.create` — crear proyecto (name, description?)
- `api.projects.update` — actualizar (name, description, slug, githubRepoUrl)
- `api.projects.remove` — eliminar con cascade
- `api.capabilities.create` — crear (projectId, name, description?)
- `api.capabilities.update` — actualizar (name, description, priority, status)
- `api.capabilities.remove` — eliminar con cascade
- `api.capabilities.reorder` — reordenar (projectId, orderedIds[])
- `api.features.create` — crear (capabilityId, name, description?, acceptanceCriteria?)
- `api.features.update` — actualizar (name, description, status, acceptanceCriteria)
- `api.features.move` — mover a otra capability
- `api.features.remove` — eliminar con cascade

---

## Tareas del Sprint (12 tareas, ~8 archivos nuevos + ~4 ediciones)

### Tarea 1: Create Project Dialog

**Spec:** Crear proyecto desde dashboard.

**Archivo nuevo:** `components/app/projects/create-project-dialog.tsx`

```
- Dialog modal con form: nombre (required), descripción (optional)
- Slug preview auto-generado debajo del input de nombre (kebab-case)
- Botón "Crear proyecto" con loading state
- useMutation(api.projects.create)
- On success: cerrar dialog, navegar a /projects/[slug]
- On error: mostrar toast con error message
- Validación: nombre 1-100 chars
```

**Edición:** `app/(authenticated)/dashboard/page.tsx`
- Reemplazar botón disabled por `<CreateProjectDialog />`
- Agregar botón "Nuevo proyecto" en header del dashboard (junto al título)

**Componentes shadcn necesarios:** dialog (ya instalado), input (ya), label (ya), button (ya), sonner/toast (ya)

---

### Tarea 2: Project Detail Page — Layout con Tabs

**Spec:** Rediseñar project detail para tener tabs de navegación.

**Instalar shadcn:** `pnpm dlx shadcn@latest add tabs`

**Edición:** `app/(authenticated)/projects/[slug]/page.tsx`

```
Rediseñar para incluir:
- Header: nombre del proyecto (editable inline), badge público/privado
- Tabs: Overview | Capabilities | Specs | Tests | Settings
- Tab "Overview" (default): vision statement, stats grid (# caps, features, specs, tests), gaps summary
- Stats vienen de api.projects.listWithMetrics o calcular client-side
- Cada tab será un componente separado (lazy loaded o inline)
```

---

### Tarea 3: Project Overview Tab

**Archivo nuevo:** `components/app/projects/project-overview.tsx`

```
- Vision statement renderizado (markdown básico, o texto plano por ahora)
- Stats grid: 4 cards con counts (capabilities, features, specs, tests)
- Coverage bar: % specs con tests
- Lista de gaps resumida (top 5) con link "Ver todos"
- Si no hay capabilities: empty state "Agrega tu primera capability"
```

**Query:** `api.projects.listWithMetrics` (ya tiene los counts)

---

### Tarea 4: Capabilities Tab — Lista con CRUD

**Archivo nuevo:** `components/app/projects/capabilities-tab.tsx`

```
- Lista de capabilities del proyecto (api.capabilities.listByProject)
- Cada capability: card con nombre, descripción (truncada), badges priority + status, count de features
- Botón "Agregar capability" abre inline form o dialog
- Click en capability: expand para mostrar features inline, o navegar a sub-ruta
- Edit inline: click en nombre para editar, click fuera para guardar
- Delete: botón con confirmación (cascade warning: "Se eliminarán X features y Y specs")
- Priority selector: dropdown con opciones critical/high/medium/low
- Status badge: draft/defined/in_progress/done con colores
```

**Archivo nuevo:** `components/app/projects/create-capability-form.tsx`

```
- Inline form (no dialog): nombre (required), descripción (optional)
- Aparece al final de la lista de capabilities
- Cancel/Submit con keyboard (Enter=submit, Escape=cancel)
- useMutation(api.capabilities.create)
```

---

### Tarea 5: Features List bajo Capability

**Archivo nuevo:** `components/app/projects/features-list.tsx`

```
- Lista de features de una capability (api.features.listByCapability)
- Cada feature: nombre, status badge, count de ACs, count de specs
- Click en feature: navegar a feature detail (sub-ruta o expand)
- Botón "Agregar feature" con inline form
- Status workflow visible: draft → defined → spec_ready → in_progress → done
```

**Archivo nuevo:** `components/app/projects/create-feature-form.tsx`

```
- Inline form: nombre (required), descripción (optional)
- useMutation(api.features.create)
```

---

### Tarea 6: Feature Detail View

**Archivo nuevo (ruta):** `app/(authenticated)/projects/[slug]/features/[featureId]/page.tsx`

**Archivo nuevo:** `components/app/features/feature-detail.tsx`

```
- Header: nombre del feature (editable), status badge con selector
- Breadcrumb: Proyecto > Capability > Feature
- Secciones:
  1. Descripción (editable)
  2. Acceptance Criteria — lista editable (add/edit/remove/reorder)
  3. User Stories — lista read-only con formato "As a X, I want Y so that Z"
  4. Specs — lista con badges tipo/status, click navega a spec
  5. Test summary — count por status (passing/failing/defined)
```

**Componente:** `components/app/features/acceptance-criteria-editor.tsx`

```
- Lista de ACs con texto editable
- Botón "+" para agregar AC
- Botón "×" para eliminar AC
- Drag handle para reordenar (puede ser v2, por ahora solo add/edit/remove)
- Al guardar: useMutation(api.features.update) con acceptanceCriteria array
```

---

### Tarea 7: Inline Edit Pattern — Componente reutilizable

**Archivo nuevo:** `components/app/inline-edit.tsx`

```
- Componente genérico: muestra texto, click para editar, blur/Enter para guardar, Escape para cancelar
- Props: value, onSave, placeholder, as? (h1, h2, p, span)
- Usado en: nombre de proyecto, nombre de capability, nombre de feature, descripción
- Soporta single-line (input) y multi-line (textarea)
```

---

### Tarea 8: Breadcrumbs

**Archivo nuevo:** `components/app/breadcrumbs.tsx`

```
- Breadcrumb trail contextual basado en la ruta
- Proyecto > Capability > Feature (con links)
- Usa nombres reales (no IDs)
- Responsive: en mobile trunca a "... > Feature"
```

**Instalar shadcn:** `pnpm dlx shadcn@latest add breadcrumb`

---

### Tarea 9: Status y Priority Badges

**Archivo nuevo:** `components/app/status-badge.tsx`

```
- Badge genérico para status con colores:
  - draft: gray
  - defined: blue
  - spec_ready: purple
  - in_progress: yellow
  - done: green
  - implemented: green
  - reviewed: blue
  - approved: purple
  - deprecated: red
- Badge para priority:
  - critical: red
  - high: orange
  - medium: yellow
  - low: gray
- Componente: <StatusBadge status="draft" /> y <PriorityBadge priority="high" />
```

---

### Tarea 10: Empty States

**Archivo nuevo:** `components/app/empty-state.tsx`

```
- Componente reutilizable para listas vacías
- Props: icon, title, description, actionLabel, onAction
- Usado en: sin capabilities, sin features, sin specs, sin ACs
- Estilo: centered, icono grande, texto descriptivo, botón CTA
```

---

### Tarea 11: Project Settings Tab

**Archivo nuevo:** `components/app/projects/project-settings.tsx`

```
- Formulario con campos editables:
  - Nombre del proyecto
  - Descripción
  - Slug (read-only, mostrar con copy button)
  - GitHub Repo URL (input)
  - Visibilidad: toggle público/privado
- Botón "Guardar cambios" con loading state
- Danger Zone:
  - Botón "Eliminar proyecto" rojo
  - Dialog de confirmación: escribir nombre del proyecto para confirmar
  - useMutation(api.projects.remove)
```

**Instalar shadcn:** `pnpm dlx shadcn@latest add switch textarea`

---

### Tarea 12: Actualizar Sidebar — Navegación a proyecto activo

**Edición:** `components/app/sidebar.tsx`

```
- Highlight del proyecto activo en la sidebar basado en la ruta actual
- Sub-items bajo el proyecto activo: Overview, Capabilities, Specs, Tests, Settings
- Collapse/expand sub-items al hacer click
```

---

## Orden de implementación recomendado

```
Fase 1 — Fundamentos (Tareas 7, 9, 10)
  Componentes reutilizables: InlineEdit, StatusBadge, PriorityBadge, EmptyState
  Son dependencias de todo lo demás.

Fase 2 — Crear y Ver Proyecto (Tareas 1, 2, 3)
  CreateProjectDialog, Project Detail con Tabs, Overview tab
  El usuario puede crear y ver proyectos.

Fase 3 — Capabilities CRUD (Tarea 4)
  CapabilitiesTab con lista, crear inline, editar, eliminar
  El usuario puede gestionar capabilities.

Fase 4 — Features CRUD (Tareas 5, 6)
  FeaturesList bajo capability, Feature Detail con ACs
  El usuario puede gestionar features y ACs.

Fase 5 — Navegación y Polish (Tareas 8, 11, 12)
  Breadcrumbs, Project Settings, Sidebar actualizada
  Navegación completa entre todas las vistas.
```

---

## Estructura de archivos resultante

```
app/(authenticated)/
  dashboard/page.tsx                           (editado: + CreateProjectDialog)
  projects/[slug]/
    page.tsx                                   (editado: tabs layout)
    features/[featureId]/page.tsx              (nuevo)
components/app/
  inline-edit.tsx                               (nuevo)
  empty-state.tsx                               (nuevo)
  status-badge.tsx                              (nuevo)
  breadcrumbs.tsx                               (nuevo)
  sidebar.tsx                                   (editado: sub-items)
  projects/
    create-project-dialog.tsx                   (nuevo)
    project-overview.tsx                        (nuevo)
    capabilities-tab.tsx                        (nuevo)
    create-capability-form.tsx                  (nuevo)
    features-list.tsx                           (nuevo)
    create-feature-form.tsx                     (nuevo)
    project-settings.tsx                        (nuevo)
  features/
    feature-detail.tsx                          (nuevo)
    acceptance-criteria-editor.tsx              (nuevo)
```

---

## Shadcn a instalar

```bash
pnpm dlx shadcn@latest add tabs breadcrumb switch textarea
```

---

## Verificación

1. `pnpm typecheck` — sin errores
2. `pnpm lint` — pasa
3. `pnpm dev` — funciona sin errores de consola
4. Flujo completo:
   - Dashboard → "Nuevo proyecto" → llenar form → aparece en sidebar
   - Click proyecto → Overview tab con stats
   - Capabilities tab → "Agregar capability" → aparece en lista
   - Click capability → features visibles
   - "Agregar feature" → click feature → detail con ACs
   - Editar ACs → guardar → verificar persist
   - Settings tab → cambiar nombre → guardar
   - Eliminar proyecto → confirmar → redirect a dashboard

---

## Specs de Fractik que se implementan en este sprint

| Spec ID | Spec | Feature |
|---------|------|---------|
| kh74mwzarh99k4m6y6d3cr1zz9842gy5 | FE-004: Project Detail View | F-1.1: CRUD de Proyectos |
| kh70namsvgjrm0zz5r1nsdhrms842xqk | FE-005: Vision Editor (parcial: read-only) | F-1.3: Vision Statement |
| kh74e5x9xjqag1bbk0tdbv8b1h843pbt | FE-006: Project Settings | F-1.4: Project Settings |
| kh715smx1k4pjf9cq7cp0ph67n842snr | FE-007: Capability Management UI | F-2.1: CRUD de Capabilities |
| kh7fcpwt27hz9g58aj008ptdt58421sk | FE-008: Feature Detail View | F-2.2: CRUD de Features |

---

## Notas para el agente

- Consultar `get_design_system(slug: "fractik")` antes de escribir CSS/estilos si existe.
- Consultar `get_spec(specId)` para cada spec antes de implementar.
- Todo el backend ya existe — este sprint es 100% frontend.
- No crear archivos en `convex/` — las mutations y queries ya están implementadas.
- UI en español: "Agregar", "Guardar", "Eliminar", "Cancelar", etc.
- Usar `useQuery` y `useMutation` de `convex/react`, no fetch.
- Cada componente debe manejar loading (skeleton) y error states.
