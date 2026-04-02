# Context Package: Sprint Core
# Fractik - Data Layer + HTTP Actions + MCP Server

> **Sprint:** Core (Paso 2 del bootstrap)
> **Objetivo:** Implementar data layer completo, CRUD functions, HTTP Actions, MCP Server, API keys. Sin frontend. Al terminar, el MCP funciona y Claude.ai puede consultar/crear datos en Fractik.
> **Fecha:** 2026-04-02
> **Prerequisito:** Paso 1 (Scaffolding) completado: Next.js + Convex + Clerk + Vercel + GitHub Actions funcionando, auth activa, CI/CD activo, cero lógica de negocio.

---

## Reglas del proyecto

- pnpm only. No npm, no yarn.
- TypeScript strict. No `any`, no `ts-ignore`.
- Toda Convex function valida orgId via `getAuthUser()`.
- Registros de otra org retornan "Not found" (nunca "Unauthorized").
- Archivos: kebab-case. Convex tables: camelCase plural. Indexes: `by_snake_case`.
- Commits: conventional commits (`feat`, `fix`, `refactor`, `docs`, `test`).
- Editar un spec o vision siempre crea versión anterior en *Versions table.
- Estructura plana (sin `src/`): `app/`, `components/`, `lib/`, `hooks/`, `convex/` en root.

---

## Orden de implementación

```
1. convex/schema.ts           ← DA-001 completo (copiar)
2. convex/lib/auth.ts         ← BE-002 (getAuthUser helper)
3. convex/projects.ts         ← BE-003 (CRUD projects) + BE-005 (vision versioning)
4. convex/capabilities.ts     ← BE-007
5. convex/features.ts         ← BE-008
6. convex/userStories.ts      ← BE-009
7. convex/specs.ts            ← BE-010 + BE-013 (spec versioning)
8. convex/specVersions.ts     ← BE-013 (queries de versiones)
9. convex/testCases.ts        ← BE-011
10. convex/divergences.ts     ← (schema listo, CRUD básico)
11. convex/sprints.ts         ← (schema listo, CRUD básico)
12. convex/apiKeys.ts         ← BE-029
13. convex/http.ts            ← BE-026 + BE-027 (HTTP Actions)
14. MCP Server config         ← BE-028
```

---

## SPEC DA-001: Data Model completo

### Schema (copiar a `convex/schema.ts`)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Projects ──────────────────────────────────────────

  projects: defineTable({
    orgId: v.string(),
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    visionContent: v.string(),
    visionVersionNumber: v.number(),
    isPublic: v.boolean(),
    githubRepoUrl: v.optional(v.string()),
    githubConnectionId: v.optional(v.id("githubConnections")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_and_slug", ["orgId", "slug"]),

  visionVersions: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    content: v.string(),
    versionNumber: v.number(),
    changeNote: v.string(),
    changedBy: v.string(),
    changedAt: v.number(),
  })
    .index("by_project", ["projectId"]),

  // ─── Hierarchy ─────────────────────────────────────────

  capabilities: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("defined"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    sortOrder: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_org", ["orgId"]),

  features: defineTable({
    orgId: v.string(),
    capabilityId: v.id("capabilities"),
    name: v.string(),
    description: v.string(),
    acceptanceCriteria: v.array(v.object({
      id: v.string(),
      text: v.string(),
      sortOrder: v.number(),
    })),
    status: v.union(
      v.literal("draft"),
      v.literal("defined"),
      v.literal("spec_ready"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    sortOrder: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_capability", ["capabilityId"])
    .index("by_org", ["orgId"]),

  userStories: defineTable({
    orgId: v.string(),
    featureId: v.id("features"),
    persona: v.string(),
    action: v.string(),
    benefit: v.string(),
    criteria: v.array(v.object({
      id: v.string(),
      text: v.string(),
      sortOrder: v.number(),
    })),
    sortOrder: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_feature", ["featureId"])
    .index("by_org", ["orgId"]),

  specs: defineTable({
    orgId: v.string(),
    featureId: v.id("features"),
    type: v.union(
      v.literal("NF"),
      v.literal("BE"),
      v.literal("FE"),
      v.literal("DA")
    ),
    title: v.string(),
    content: v.string(),
    technicalNotes: v.optional(v.string()),
    constraints: v.optional(v.string()),
    dependencies: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("reviewed"),
      v.literal("approved"),
      v.literal("implemented"),
      v.literal("deprecated")
    ),
    isDesignSystem: v.optional(v.boolean()),
    isDataModel: v.optional(v.boolean()),
    versionNumber: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_feature", ["featureId"])
    .index("by_org", ["orgId"])
    .index("by_org_and_type", ["orgId", "type"]),

  specVersions: defineTable({
    orgId: v.string(),
    specId: v.id("specs"),
    content: v.string(),
    versionNumber: v.number(),
    changeNote: v.string(),
    changedBy: v.string(),
    changedAt: v.number(),
  })
    .index("by_spec", ["specId"]),

  testCases: defineTable({
    orgId: v.string(),
    specId: v.id("specs"),
    type: v.union(
      v.literal("unit"),
      v.literal("integration"),
      v.literal("e2e"),
      v.literal("manual")
    ),
    title: v.string(),
    preconditions: v.string(),
    steps: v.array(v.object({
      id: v.string(),
      action: v.string(),
      expectedResult: v.string(),
      sortOrder: v.number(),
    })),
    status: v.union(
      v.literal("defined"),
      v.literal("passing"),
      v.literal("failing"),
      v.literal("skipped"),
      v.literal("blocked")
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spec", ["specId"])
    .index("by_org", ["orgId"])
    .index("by_org_and_type", ["orgId", "type"]),

  testStatusLog: defineTable({
    orgId: v.string(),
    testCaseId: v.id("testCases"),
    previousStatus: v.string(),
    newStatus: v.string(),
    note: v.optional(v.string()),
    changedBy: v.string(),
    changedAt: v.number(),
  })
    .index("by_test_case", ["testCaseId"]),

  // ─── Implementation Control ────────────────────────────

  sprints: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed")
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_org", ["orgId"]),

  sprintItems: defineTable({
    orgId: v.string(),
    sprintId: v.id("sprints"),
    entityType: v.union(v.literal("spec"), v.literal("test")),
    entityId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("verified")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_org", ["orgId"]),

  logEntries: defineTable({
    orgId: v.string(),
    sprintId: v.id("sprints"),
    type: v.union(
      v.literal("progress"),
      v.literal("note"),
      v.literal("blocker"),
      v.literal("defect")
    ),
    content: v.string(),
    author: v.string(),
    createdAt: v.number(),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_org", ["orgId"]),

  defects: defineTable({
    orgId: v.string(),
    sprintId: v.id("sprints"),
    specId: v.id("specs"),
    title: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved")
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_spec", ["specId"])
    .index("by_org", ["orgId"]),

  // ─── Library ───────────────────────────────────────────

  librarySpecs: defineTable({
    orgId: v.string(),
    type: v.union(
      v.literal("NF"),
      v.literal("BE"),
      v.literal("FE"),
      v.literal("DA")
    ),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    visibility: v.union(v.literal("public"), v.literal("org")),
    versionNumber: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_visibility", ["visibility"])
    .index("by_org_and_type", ["orgId", "type"]),

  librarySops: defineTable({
    orgId: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("auth"),
      v.literal("deploy"),
      v.literal("database"),
      v.literal("api"),
      v.literal("email"),
      v.literal("cms"),
      v.literal("monitoring"),
      v.literal("other")
    ),
    tags: v.array(v.string()),
    visibility: v.union(v.literal("public"), v.literal("org")),
    versionNumber: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_visibility", ["visibility"])
    .index("by_org_and_category", ["orgId", "category"]),

  // ─── Agent Interface ───────────────────────────────────

  apiKeys: defineTable({
    orgId: v.string(),
    name: v.string(),
    hashedKey: v.string(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_hash", ["hashedKey"]),

  // ─── Divergences ───────────────────────────────────────

  divergences: defineTable({
    orgId: v.string(),
    specId: v.id("specs"),
    sprintId: v.optional(v.id("sprints")),
    type: v.union(
      v.literal("deviation"),
      v.literal("enhancement"),
      v.literal("issue")
    ),
    description: v.string(),
    reportedBy: v.string(),
    decision: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    decisionNote: v.optional(v.string()),
    decidedBy: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_spec", ["specId"])
    .index("by_sprint", ["sprintId"])
    .index("by_org", ["orgId"])
    .index("by_org_and_decision", ["orgId", "decision"]),

  // ─── Repo Intelligence ─────────────────────────────────

  githubConnections: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    repoUrl: v.string(),
    owner: v.string(),
    repo: v.string(),
    tokenEncrypted: v.string(),
    status: v.union(
      v.literal("connected"),
      v.literal("disconnected"),
      v.literal("error")
    ),
    lastSyncAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_org", ["orgId"]),
});
```

### Reglas de integridad

1. **Multi-tenancy:** Todo registro tiene `orgId`. Toda query/mutation valida `record.orgId === userOrgId`. Cross-org retorna "Not found".
2. **Cascade deletes:** project > capabilities > features > userStories, specs > specVersions, testCases > testStatusLog, divergences. También visionVersions, sprints > sprintItems, logEntries, defects, githubConnections.
3. **Unicidad:** `projects.slug` único por orgId. Max 1 `isDesignSystem=true` y 1 `isDataModel=true` por proyecto. Max 1 sprint `active` por proyecto.
4. **Versionamiento:** Editar `visionContent` o `specs.content` guarda snapshot anterior en la tabla de versiones. Las versiones son inmutables.
5. **Status workflows:** features: draft > defined > spec_ready > in_progress > done. specs: draft > reviewed > approved > implemented | deprecated. testCases: defined > passing | failing | skipped | blocked.

---

## SPEC NF-001: Auth pattern con Clerk

Toda autenticación via Clerk. `@clerk/nextjs` con `ClerkProvider` en root layout. Clerk middleware en `middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

Rutas públicas: `/`, `/sign-in`, `/sign-up`. Todo lo demás requiere auth. Post-login: `/dashboard`. Post-signup: `/onboarding`.

---

## SPEC NF-002: Multi-tenancy por orgId

Todo dato aislado por org. Campo `orgId` en toda tabla. Helper `getAuthUser(ctx)` como primera línea de toda function. Cross-org retorna "Not found", nunca "Unauthorized".

---

## SPEC BE-002: getAuthUser helper

Archivo: `convex/lib/auth.ts`

```typescript
import { QueryCtx, MutationCtx } from "./_generated/server";

export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const orgId = identity.org_id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return {
    userId: identity.subject,
    orgId: orgId as string,
  };
}
```

Requiere Clerk JWT template con claim `org_id` configurado para Convex.

---

## SPEC BE-003: CRUD mutations projects

Archivo: `convex/projects.ts`

### projects.create
- args: `{ name: v.string(), description: v.optional(v.string()) }`
- Genera slug en kebab-case desde name. Si slug existe en la org, append `-2`, `-3`.
- Inserta con: orgId, visionContent: "", visionVersionNumber: 1, isPublic: false, createdBy: userId, timestamps.
- Retorna ID.

### projects.update
- args: `{ projectId: v.id("projects"), name?, description?, slug? }`
- Valida ownership. Si slug cambia, validar unicidad. Patch + updatedAt.

### projects.remove
- args: `{ projectId: v.id("projects") }`
- Valida ownership. Cascade delete de TODO debajo (ver reglas de integridad DA-001).

### projects.get
- args: `{ projectId: v.id("projects") }`
- Valida ownership. Retorna proyecto completo.

### projects.getBySlug
- args: `{ slug: v.string() }`
- Query by_org_and_slug. Retorna proyecto o null.

### projects.listWithMetrics
- args: `{}`
- Query projects by_org. Para cada uno: count capabilities, features, specs, tests. Calcular % coverage. Count divergencias pending. Ordenar por updatedAt desc.

Reglas: slug kebab-case, min 2 chars, max 50. Name min 1, max 100.

---

## SPEC BE-005: Vision versioning mutations

Archivo: `convex/projects.ts` (misma archivo que BE-003)

### projects.updateVision
- args: `{ projectId: v.id("projects"), content: v.string(), changeNote: v.optional(v.string()) }`
- Valida ownership.
- Guarda versión anterior: insert en visionVersions con { projectId, content: project.visionContent, versionNumber: project.visionVersionNumber, changeNote, changedBy: userId, changedAt: now }.
- Patch project: visionContent = content, visionVersionNumber++, updatedAt.

### visionVersions.listByProject
- args: `{ projectId: v.id("projects") }`
- Query by_project, sort changedAt desc. Retorna metadata (sin content para la lista).

### visionVersions.get
- args: `{ versionId: v.id("visionVersions") }`
- Retorna contenido completo. Valida ownership via project.

---

## SPEC BE-007: CRUD mutations capabilities

Archivo: `convex/capabilities.ts`

### capabilities.create
- args: `{ projectId: v.id("projects"), name: v.string(), description?: v.string() }`
- Valida project ownership. sortOrder = count existentes. Defaults: priority "medium", status "draft".

### capabilities.update
- args: `{ capabilityId, name?, description?, priority?, status? }`
- Valida ownership. Patch + updatedAt.

### capabilities.remove
- args: `{ capabilityId }`
- Cascade: features > userStories, specs > specVersions, testCases > testStatusLog, divergences. Reordenar siblings.

### capabilities.reorder
- args: `{ projectId, orderedIds: v.array(v.id("capabilities")) }`
- Actualizar sortOrder según posición.

### capabilities.listByProject
- args: `{ projectId }`
- Query by_project, sort by sortOrder.

---

## SPEC BE-008: CRUD mutations features

Archivo: `convex/features.ts`

### features.create
- args: `{ capabilityId, name, description? }`
- Valida capability ownership. Defaults: acceptanceCriteria [], status "draft", sortOrder auto.

### features.update
- args: `{ featureId, name?, description?, status?, acceptanceCriteria? }`
- Status workflow: draft > defined > spec_ready > in_progress > done. spec_ready solo si readiness 7/7.

### features.move
- args: `{ featureId, targetCapabilityId }`
- Valida ambos. Actualiza capabilityId. Stories/specs/tests mantienen referencia via featureId.

### features.remove
- Cascade: userStories, specs > specVersions, testCases > testStatusLog, divergences.

### features.listByCapability
- args: `{ capabilityId }`
- Sort by sortOrder.

---

## SPEC BE-009: CRUD mutations userStories

Archivo: `convex/userStories.ts`

### userStories.create
- args: `{ featureId, persona, action, benefit }`
- Todos strings no vacíos. Defaults: criteria [], sortOrder auto.

### userStories.update
- args: `{ storyId, persona?, action?, benefit?, criteria? }`

### userStories.remove
- Simple delete, no cascade.

### userStories.listByFeature
- args: `{ featureId }`

---

## SPEC BE-010: CRUD mutations specs

Archivo: `convex/specs.ts`

### specs.create
- args: `{ featureId, type, title, content?, isDesignSystem?, isDataModel? }`
- Si isDesignSystem=true, verificar que no exista otro en el proyecto. Idem isDataModel.
- Defaults: status "draft", versionNumber 1, content "".

### specs.updateContent
- args: `{ specId, content, changeNote? }`
- Guarda versión anterior en specVersions (vía lógica de BE-013). Incrementa versionNumber. Patch + updatedAt.

### specs.updateStatus
- args: `{ specId, status }`
- Transiciones válidas: draft > reviewed, reviewed > approved, approved > implemented, any > deprecated. Draft > approved es INVALIDO.

### specs.remove
- Cascade: specVersions, testCases > testStatusLog, divergences.

### specs.get
- args: `{ specId }`
- Retorna spec completo. Valida ownership.

### specs.listByFeature
- args: `{ featureId }`

### specs.listByProject
- args: `{ projectId, type?, status? }`
- Cross-entity: project > capabilities > features > specs. Enriquecer con featureName, capabilityName, testCount, hasDivergences.

---

## SPEC BE-013: Spec versioning mutations

Archivo: `convex/specVersions.ts`

La lógica de guardar versión anterior se invoca desde `specs.updateContent` (BE-010).

### specVersions.listBySpec
- args: `{ specId }`
- Query by_spec, sort changedAt desc. Retorna metadata sin content.

### specVersions.get
- args: `{ versionId }`
- Retorna contenido completo. Valida ownership.

---

## SPEC BE-011: CRUD mutations testCases

Archivo: `convex/testCases.ts`

### testCases.create
- args: `{ specId, type, title, preconditions?, steps? }`
- Defaults: status "defined", preconditions "", steps [].

### testCases.update
- args: `{ testCaseId, title?, preconditions?, steps? }`

### testCases.updateStatus
- args: `{ testCaseId, status, note? }`
- Registra en testStatusLog: { previousStatus, newStatus, note, changedBy, changedAt }.

### testCases.remove
- Delete testStatusLog entries, luego el testCase.

### testCases.listBySpec
- args: `{ specId }`

---

## SPEC BE-029: API key management

Archivo: `convex/apiKeys.ts`

### apiKeys.create (action, no mutation, porque necesita crypto)
- args: `{ name }`
- Genera: `fk_live_` + 32 hex chars random.
- Hash: SHA-256 del key completo.
- Inserta: { name, hashedKey, orgId, createdBy }.
- Retorna: { keyId, fullKey }. fullKey solo visible esta vez.

### apiKeys.revoke
- args: `{ keyId }`
- Patch: revokedAt = Date.now(). Inmediato e irreversible.

### apiKeys.list
- Retorna keys de la org: name, createdAt, lastUsedAt, revokedAt. NO retorna hashedKey.

### apiKeys.validate (internal query)
- args: `{ key }`
- Hash input, lookup por by_hash. Si no existe o revokedAt: retorna null. Si OK: actualiza lastUsedAt, retorna { orgId, userId }.

---

## SPEC BE-026: HTTP Actions read endpoints

Archivo: `convex/http.ts`

Auth: Bearer token (API key) validado via apiKeys.validate en cada request.
Rate limit: 100 req/min por key.
Response: `{ data: T, meta: { timestamp: number } }`.
Error: `{ error: string }` con status code.

| Método | Ruta | Lógica |
|---|---|---|
| GET | /api/projects | projects.listWithMetrics (filtrado por org de la API key) |
| GET | /api/projects/:slug/tree | Árbol nested: project > capabilities > features > specs > tests |
| GET | /api/specs/:id | specs.get + testCases.listBySpec |
| GET | /api/specs/:id/versions | specVersions.listBySpec |
| GET | /api/specs/design-system?project=:slug | specs query isDesignSystem=true |
| GET | /api/specs/data-model?project=:slug | specs query isDataModel=true |
| GET | /api/gaps/:slug | gaps.detect (implementar inline o en archivo separado) |
| GET | /api/coverage/:slug | gaps.coverage |
| GET | /api/library/specs | librarySpecs.list |
| GET | /api/library/sops/:id | librarySops.get |

### Patrón de HTTP Action:

```typescript
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/projects",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await validateApiKey(ctx, request);
    if (!auth) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const projects = await ctx.runQuery(internal.projects.listByOrg, {
      orgId: auth.orgId,
    });

    return jsonResponse({ data: projects, meta: { timestamp: Date.now() } });
  }),
});

// Helper
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function validateApiKey(ctx: any, request: Request) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const key = header.replace("Bearer ", "");
  return await ctx.runQuery(internal.apiKeys.validate, { key });
}

export default http;
```

Nota: las queries internas (`internal.*`) son versiones de las queries que aceptan orgId como parámetro en lugar de leerlo del JWT. Esto permite que HTTP Actions (que no tienen JWT de Clerk) pasen el orgId obtenido de la API key.

---

## SPEC BE-027: HTTP Actions write endpoints

Mismo archivo `convex/http.ts`.

| Método | Ruta | Lógica |
|---|---|---|
| PATCH | /api/specs/:id/status | specs.updateStatus |
| PATCH | /api/tests/:id/status | testCases.updateStatus |
| POST | /api/sprints/:id/log | logEntries.create |
| POST | /api/sprints/:id/defects | defects.create |
| POST | /api/divergences | divergences.create |

Misma auth, rate limit, response format.

---

## SPEC BE-028: MCP Server adapter

El MCP Server se implementa como HTTP Actions adicionales en `convex/http.ts` que responden al protocolo MCP, o como un adaptador externo que llama a las HTTP Actions.

### MCP Tools (lectura):

| Tool | Llama a | Output |
|---|---|---|
| query_project | GET /api/projects/:slug/tree | Texto formateado con indentación del árbol |
| get_spec | GET /api/specs/:id | Título + tipo + status + contenido markdown |
| get_gaps | GET /api/gaps/:slug | Lista de gaps con paths |
| get_design_system | GET /api/specs/design-system | Contenido del Design System spec |
| get_data_model | GET /api/specs/data-model | Contenido del Data Model spec |
| get_spec_versions | GET /api/specs/:id/versions | Lista de versiones |
| query_library | GET /api/library/specs | Lista filtrable |

### MCP Tools (escritura):

| Tool | Llama a | Input |
|---|---|---|
| update_spec_status | PATCH /api/specs/:id/status | specId, status |
| update_test_status | PATCH /api/tests/:id/status | testId, status |
| add_log_entry | POST /api/sprints/:id/log | sprintId, type, content |
| report_divergence | POST /api/divergences | specId, type, description |

Responses formateadas como texto legible (no JSON crudo).
Auth via API key configurada en el MCP server config.

---

## Estructura de archivos esperada al terminar

```
convex/
├── schema.ts              ← DA-001 (copiar schema completo)
├── lib/
│   └── auth.ts            ← BE-002 (getAuthUser)
├── projects.ts            ← BE-003 + BE-005
├── capabilities.ts        ← BE-007
├── features.ts            ← BE-008
├── userStories.ts         ← BE-009
├── specs.ts               ← BE-010
├── specVersions.ts        ← BE-013
├── testCases.ts           ← BE-011
├── divergences.ts         ← CRUD básico
├── sprints.ts             ← CRUD básico
├── apiKeys.ts             ← BE-029
└── http.ts                ← BE-026 + BE-027 + BE-028 (MCP)
```

---

## Criterios de completitud del Sprint Core

El sprint está completo cuando:

1. `npx convex dev` corre sin errores con el schema completo
2. Todas las mutations de CRUD (projects, capabilities, features, stories, specs, tests) funcionan
3. getAuthUser valida orgId correctamente
4. Versionamiento funciona: editar spec/vision crea versión anterior
5. API keys se crean, validan (hash) y revocan correctamente
6. HTTP Actions responden con auth por Bearer token
7. Al menos los endpoints de lectura (GET /api/projects, GET /api/specs/:id, GET /api/projects/:slug/tree) funcionan
8. MCP Server es conectable desde Claude.ai y responde a query_project y get_spec
