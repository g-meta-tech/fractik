# Fractik

Meta-development platform for AI-assisted software engineering.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Backend:** Convex (DB, file storage, scheduled functions)
- **Auth:** Clerk (multi-tenancy via organizations)
- **UI:** Shadcn/ui + Tailwind CSS
- **Language:** TypeScript (strict mode)
- **Package manager:** pnpm

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 9+
- Convex account with project configured
- Clerk account with org + JWT template configured

### Setup

1. Clone the repo:

```bash
git clone https://github.com/g-meta-tech/fractik.git
cd fractik
pnpm install
```

2. Copy environment variables and fill in your keys:

```bash
cp .env.example .env.local
```

3. Start the dev server (Next.js + Convex in one command):

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js + Convex dev servers |
| `pnpm build` | Production build (deploys Convex if key is set) |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm convex:dev` | Start only Convex dev server |
| `pnpm convex:deploy` | Deploy Convex to production |

## Project Structure

```
app/                            Next.js App Router
  (authenticated)/              Protected routes (sidebar layout)
    dashboard/                  Projects dashboard
  sign-in/                      Clerk sign-in
  sign-up/                      Clerk sign-up
components/
  ui/                           Shadcn components (auto-generated)
  app/                          Application components
  providers/                    Context providers (Convex, Theme)
hooks/                          Custom React hooks
lib/                            Utilities, helpers, types
convex/
  schema.ts                     Database schema
  lib/auth.ts                   Auth helper (getAuthUser)
  http.ts                       HTTP Actions router
docs/                           Product documentation
  completed/                    Implemented context packages
```

## CI/CD

- **GitHub Actions:** Runs lint, typecheck, and build on every push/PR to `main` and `dev`
- **Vercel:** Auto-deploys on push — `main` to production, other branches to preview
- **Convex:** Deployed as part of the Vercel build step

## Environments

| Environment | Branch | Vercel | Convex |
|-------------|--------|--------|--------|
| Production | `main` | fractik.g-meta.tech | prod deployment |
| Preview | `dev` / PRs | Preview URLs | dev deployment |
| Local | any | localhost:3000 | dev deployment |

## Implementation Progress

Completed context packages are archived in `docs/completed/`:

- **Scaffolding v3** — Next.js 16 + Convex + Clerk + Shadcn + Vercel + CI/CD
- **Sprint Core** — Data layer, CRUD functions, HTTP Actions, MCP Server, API keys

## Contributing

- Use `pnpm` exclusively (never npm, npx, or yarn)
- Run `pnpm typecheck && pnpm lint` before committing
- Follow conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Branch naming: `feature/F-{id}-{slug}`, `fix/{description}`
