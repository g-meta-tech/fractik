@AGENTS.md

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Fractik - Agent Instructions

## Stack
- Next.js 16 (App Router)
- React 19
- TypeScript (strict mode)
- Convex (backend, DB, file storage, scheduled functions)
- Clerk (auth, multi-tenancy via organizations)
- Shadcn/ui + Tailwind CSS
- pnpm (package manager)

## Comandos
- `pnpm dev` - dev server (Next.js + Convex)
- `pnpm build` - build de producción
- `pnpm lint` - ESLint
- `pnpm typecheck` - tsc --noEmit
- `pnpm convex:dev` - solo Convex dev
- `pnpm convex:deploy` - deploy Convex a prod

## Regla de pnpm (CRÍTICA)
NUNCA usar npm ni npx. Equivalencias:
- npx {paquete} → pnpm dlx {paquete}
- npm install → pnpm add
- npm install -g → pnpm add -g
- npm run {script} → pnpm {script}

## Convenciones
- Archivos: kebab-case (spec-card.tsx)
- Componentes React: PascalCase named export (export function SpecCard())
- Hooks: camelCase con prefijo use (useSidebar)
- Convex tables: camelCase plural (testCases, apiKeys)
- Convex functions: camelCase (specs.listByFeature)
- Convex indexes: snake_case con prefijo by_ (by_feature)
- Commits: conventional commits (feat:, fix:, chore:, docs:)
- Branches: feature/F-{id}-{slug}, fix/{description}
- Imports: path aliases con @/ para root/

## Estructura
```
app/                            Next.js App Router
  (authenticated)/              Rutas protegidas (layout con sidebar)
    dashboard/                  Dashboard de proyectos
  sign-in/                      Clerk sign-in
  sign-up/                      Clerk sign-up
components/
  ui/                           Shadcn (auto-generado, no editar manualmente)
  app/                          Componentes de la aplicación
  providers/                    Context providers (Convex, Theme)
hooks/                          Custom React hooks
lib/                            Utilities, helpers, types
convex/
  schema.ts                     Definición del schema
  lib/
    auth.ts                     getAuthUser() helper
  http.ts                       HTTP Actions (API + MCP)
docs/                           Documentación del producto (specs, etc.)
```

## Reglas
- NO usar npm, npx, ni yarn. Solo pnpm y pnpm dlx.
- NO crear archivos .js, todo es .ts o .tsx
- NO usar `any` en TypeScript, usar tipos explícitos
- Convex functions: usar v. validators, no tipos genéricos
- Multi-tenancy: toda query/mutation valida orgId via getAuthUser()
- Cross-org: retornar "Not found", nunca "Unauthorized"
- Correr `pnpm typecheck` antes de cada commit
- Correr `pnpm lint` antes de cada commit
