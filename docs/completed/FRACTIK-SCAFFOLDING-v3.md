# Fractik: Scaffolding v3 - Paso 1 del Bootstrap

> **Versión:** 3.0
> **Fecha:** 2026-04-02
> **Propósito:** Documento ejecutable para Claude Code. Crea la app de Fractik desde cero.
> **Resultado:** fractik.g-meta.tech corriendo con auth, CI/CD, cero lógica de negocio.
> **Stack:** Next.js 16 (App Router) + Convex + Clerk v7 + Shadcn v4 (Base UI) + Vercel + GitHub Actions
> **Package manager:** pnpm 10 (NUNCA npm ni npx)
>
> **Changelog v3:** Fixes de v2 → v3: quitar asChild de sidebar (usar render prop), proxy.ts en raíz (no app/), auth.config con variable nombrada, .gitignore (!.env.example, .claude/), quitar CONVEX_DEPLOYMENT de M4, --yes en create-next-app, shadcn init --defaults, preservar bloque Convex en CLAUDE.md, agregar README.md, pnpm-action-setup con run_install:false, custom event en use-sidebar, repo org g-meta-tech.
>
> **Changelog v2:** Correcciones post ejecución real: Next.js 16 (proxy.ts, no middleware.ts, eslint . no next lint), Shadcn v4/Base UI (render prop, no asChild), Clerk v7 (sin afterSignOutUrl), pnpm 10 (workspace fix), Convex deploy condicional, redirect auth en proxy, useSyncExternalStore para sidebar, orden de ejecución corregido.

---

## PARTE 0: PASOS MANUALES PREVIOS (humano, ANTES de Claude Code)

> Completar ANTES de ejecutar la Parte 1. Claude Code necesita las keys en .env.local.

### Paso M1: GitHub repo (5 min)

- [ ] Crear repo `g-meta-tech/fractik` (público, evita problemas con Vercel Hobby)
- [ ] NO inicializar con README ni .gitignore (Claude Code hace el primer commit)

### Paso M2: Clerk (10 min)

- [ ] dashboard.clerk.com → Create application → "Fractik"
- [ ] **Configure tab → Sign-in methods:** habilitar Email + Google OAuth
- [ ] **Configure tab → Organization settings:** Enable organizations
- [ ] **Configure tab → JWT Templates:** Create template
  - Name: `convex`
  - Claims: `{ "org_id": "{{org.id}}" }`
  - Anotar el **Issuer** domain
- [ ] Copiar keys:

```
De API Keys tab (sidebar):
  ✓ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_test_...)
  ✓ CLERK_SECRET_KEY (sk_test_...)

De JWT Templates tab → template "convex":
  ✓ CLERK_JWT_ISSUER_DOMAIN (https://....clerk.accounts.dev)
```

### Paso M3: Convex (5 min)

> Hacer DESPUÉS de Clerk (necesitas CLERK_JWT_ISSUER_DOMAIN)

- [ ] dashboard.convex.dev → Create project → "fractik"

```
De la página principal del proyecto:
  ✓ NEXT_PUBLIC_CONVEX_URL (https://xxx.convex.cloud)

De Settings → Deploy Keys → Generate:
  ✓ CONVEX_DEPLOY_KEY (prod:xxx...)

Para preview/dev:
  ✓ CONVEX_DEPLOY_KEY dev (dev:xxx...)
```

### Paso M4: Crear .env.local (2 min)

- [ ] En el directorio de trabajo, crear `.env.local` con las keys reales:

```bash
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_JWT_ISSUER_DOMAIN=https://xxx.clerk.accounts.dev

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

> Nota: `CONVEX_DEPLOYMENT` se agrega automáticamente por `convex init` (paso 6). No incluirlo aquí.

**Total pasos M1-M4: ~22 min. Claude Code puede arrancar después.**

---

## PARTE 1: CÓDIGO (Claude Code ejecuta)

> Prerequisito: .env.local existe con keys reales (Paso M4)

### 1. Crear proyecto

```bash
pnpm create next-app@latest fractik \
  --yes \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --import-alias "@/*" \
  --turbopack

cd fractik
```

> create-next-app ya inicializa git. NO hacer `git init` después.
> No usar `--src-dir`. Paths son app/, components/, hooks/, lib/.

### 2. Fix pnpm workspace

```bash
rm pnpm-workspace.yaml
```

En `package.json`, agregar al nivel raíz:
```json
{
  "packageManager": "pnpm@10.0.0",
  "pnpm": {
    "ignoredBuiltDependencies": ["@swc/core", "esbuild"]
  }
}
```

### 3. Node version

Crear `.nvmrc`:
```
22
```

### 4. TypeScript strict

En `tsconfig.json`, asegurar:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 5. Dependencias

```bash
pnpm add convex @clerk/nextjs next-themes lucide-react

pnpm dlx shadcn@latest init --defaults

pnpm dlx shadcn@latest add button card input label badge \
  dropdown-menu avatar separator tooltip skeleton \
  scroll-area sheet dialog sonner
```

> Si `--defaults` no está disponible, verificar con `pnpm dlx shadcn@latest init --help` y usar los flags equivalentes.

### 5b. Patch next-themes (React 19 script warning)

> `next-themes` inyecta un `<script>` tag dentro de un componente React. React 19 lanza un console warning por esto (PR #386 upstream sin merge). Aplicar patch con pnpm:

```bash
pnpm patch next-themes@0.4.6
```

En los archivos `dist/index.mjs` y `dist/index.js` del directorio de patch, buscar `return t.createElement("script",{...w,suppressHydrationWarning` y anteponer `if(typeof window!=="undefined")return null;`:

```
// Antes:
return t.createElement("script",{...w,suppressHydrationWarning...

// Después:
if(typeof window!=="undefined")return null;return t.createElement("script",{...w,suppressHydrationWarning...
```

Commit del patch:
```bash
pnpm patch-commit '<ruta que imprimió pnpm patch>'
```

> Esto genera `patches/next-themes@0.4.6.patch` y agrega `patchedDependencies` a `package.json`. El patch se aplica automáticamente en `pnpm install`. Cuando `next-themes` publique un fix upstream, eliminar el patch.

### 6. Convex init

> Hacer ANTES de CLAUDE.md (convex init lo sobrescribe)

```bash
pnpm dlx convex init
```

> Esto genera `convex/_generated/`, agrega `CONVEX_DEPLOYMENT` a `.env.local`, y modifica CLAUDE.md y AGENTS.md.

### 7. Scripts

En `package.json`, reemplazar scripts:
```json
{
  "scripts": {
    "dev": "pnpm dlx convex dev --once && pnpm dlx convex dev & next dev --turbopack",
    "build": "if [ -n \"$CONVEX_DEPLOY_KEY\" ]; then pnpm dlx convex deploy; fi && next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "convex:dev": "pnpm dlx convex dev",
    "convex:deploy": "pnpm dlx convex deploy"
  }
}
```

### 8. ESLint ignore Convex generated

En `eslint.config.mjs`, agregar `"convex/_generated/**"` a globalIgnores:

```js
globalIgnores([
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  "convex/_generated/**",
]),
```

### 9. .gitignore actualizaciones

Agregar al `.gitignore` existente:
```
# Claude Code
.claude/

# Asegurar que .env.example no se excluya
!.env.example
```

### 10. Convex auth config

Crear `convex/auth.config.ts`:
```typescript
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
```

### 11. Convex schema base

Reemplazar `convex/schema.ts`:
```typescript
import { defineSchema } from "convex/server";

export default defineSchema({
  // Sprint Core agregará las tablas aquí
});
```

### 12. Auth helper

Crear `convex/lib/auth.ts`:
```typescript
import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

export async function getAuthUser(
  ctx: QueryCtx | MutationCtx | ActionCtx
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const orgId = identity.org_id as string | undefined;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return {
    userId: identity.subject,
    orgId,
    name: identity.name ?? "Unknown",
    email: identity.email ?? "",
  };
}
```

### 13. HTTP Actions placeholder

Crear `convex/http.ts`:
```typescript
import { httpRouter } from "convex/server";

const http = httpRouter();

// Sprint Core agregará:
// GET /api/projects, /api/projects/:id/tree, /api/specs/:id, /api/gaps/:projectId
// POST /api/specs/:id/status
// MCP Server endpoints

export default http;
```

### 14. Clerk proxy

> Next.js 16 usa proxy.ts en la RAÍZ del proyecto, NO middleware.ts ni app/proxy.ts.
> Eliminar middleware.ts si existe.

Crear `proxy.ts` (en la raíz del proyecto):
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  if (userId && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### 15. Providers

Crear `components/providers/convex-client-provider.tsx`:
```tsx
"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

Crear `components/providers/theme-provider.tsx`:
```tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

### 16. Root layout

Reemplazar `app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Fractik",
  description: "Meta-development platform for AI-assisted software engineering",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="es" suppressHydrationWarning>
        <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ConvexClientProvider>
              {children}
              <Toaster />
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### 17. Landing page

Reemplazar `app/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Fractik</h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Meta-development platform for AI-assisted software engineering
        </p>
      </div>
      <Button size="lg" render={<Link href="/sign-in" />} nativeButton={false}>
        Iniciar
      </Button>
    </div>
  );
}
```

> Shadcn v4: `render` prop + `nativeButton={false}`, NO `asChild`. Auth redirect está en proxy.ts.

### 18. Auth pages

Crear `app/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

Crear `app/sign-up/[[...sign-up]]/page.tsx`:
```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

### 19. Sidebar hook

Crear `hooks/use-sidebar.ts`:
```typescript
"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "fractik-sidebar-collapsed";
const EVENT_NAME = "fractik-sidebar-change";

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

export function useSidebar() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !getSnapshot();
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }, []);

  return { collapsed, toggle };
}
```

### 20. Sidebar component

> **IMPORTANTE:** Shadcn v4 usa Base UI. NO usar `asChild` en ningún componente.
> Los triggers (TooltipTrigger, DropdownMenuTrigger, SheetTrigger) aceptan
> children directamente o usan `render` prop para composición.

Crear `components/app/sidebar.tsx`:
```tsx
"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const { setTheme } = useTheme();

  return (
    <aside
      className={`flex h-screen flex-col border-r bg-background transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-[240px]"
      }`}
    >
      {/* Top: Org switcher */}
      <div className="flex items-center justify-between border-b p-3">
        {!collapsed && (
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full justify-start",
              },
            }}
          />
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<button type="button" />}
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={toggle}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expandir" : "Colapsar"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Middle: Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {!collapsed && (
          <div className="mt-4 px-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Proyectos
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sin proyectos aún
            </p>
          </div>
        )}
      </nav>

      {/* Bottom: Theme toggle + User */}
      <div className="border-t p-3 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              Claro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              Oscuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />
              Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className={collapsed ? "flex justify-center" : ""}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </div>
    </aside>
  );
}
```

Crear `components/app/mobile-sidebar.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground md:hidden">
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[240px]">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
```

### 21. Authenticated layout

Crear `app/(authenticated)/layout.tsx`:
```tsx
import { Sidebar } from "@/components/app/sidebar";
import { MobileSidebar } from "@/components/app/mobile-sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto">
        <div className="flex items-center border-b p-3 md:hidden">
          <MobileSidebar />
          <span className="ml-3 font-semibold">Fractik</span>
        </div>
        <div className="mx-auto max-w-[1280px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
```

### 22. Dashboard

Crear `app/(authenticated)/dashboard/page.tsx`:
```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">No hay proyectos aún</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Crea tu primer proyecto para empezar a definir la estructura
            de tu producto.
          </p>
          <Button className="mt-6" disabled>
            Crear proyecto
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Disponible en Sprint Core
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 23. Archivos de configuración

Crear `.env.example`:
```bash
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

Crear `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type Check
        run: pnpm typecheck

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_CONVEX_URL: ${{ vars.NEXT_PUBLIC_CONVEX_URL }}
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

Crear `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "files.associations": { "*.css": "tailwindcss" }
}
```

Crear `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

Crear `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80
}
```

### 24. CLAUDE.md

> Crear DESPUÉS de convex init (paso 6). Leer el CLAUDE.md actual para
> extraer el bloque `<!-- convex-ai-start -->...<!-- convex-ai-end -->`
> generado por Convex, e incluirlo en el nuevo archivo.

Crear `CLAUDE.md` preservando el bloque de Convex:
```markdown
@AGENTS.md

<!-- convex-ai-start -->
(preservar el bloque generado por convex init aquí)
<!-- convex-ai-end -->

# Fractik - Agent Instructions

## Stack
- Next.js 16 (App Router), React 19, TypeScript (strict)
- Convex (backend, DB, scheduled functions)
- Clerk v7 (auth, multi-tenancy via organizations)
- Shadcn/ui v4 (Base UI) + Tailwind CSS
- pnpm 10

## Comandos
- pnpm dev (Next.js + Convex)
- pnpm build (Convex deploy condicional + Next build)
- pnpm lint (eslint ., NOT next lint)
- pnpm typecheck (tsc --noEmit)

## Regla de pnpm (CRÍTICA)
NUNCA npm ni npx:
- npx → pnpm dlx
- npm install → pnpm add
- npm install -g → pnpm add -g
- npm run → pnpm

## Shadcn v4 / Base UI
- NO asChild (no existe). Usar render prop: <Button render={<Link />} nativeButton={false} />
- Triggers (TooltipTrigger, DropdownMenuTrigger, SheetTrigger): usan children directamente o render prop

## Clerk v7
- proxy.ts en raíz del proyecto, NO middleware.ts (Next.js 16)
- UserButton sin afterSignOutUrl

## Convenciones
- Archivos: kebab-case. Componentes: PascalCase named export
- Convex tables: camelCase plural. Functions: camelCase. Indexes: by_snake_case
- Commits: conventional (feat:, fix:, chore:, docs:)
- Branches: feature/F-{id}-{slug}, fix/{slug}
- Imports: path aliases con @/ para root/
- Multi-tenancy: toda function valida orgId via getAuthUser()
- Cross-org: "Not found", nunca "Unauthorized"
- Correr pnpm typecheck && pnpm lint antes de cada commit

## Estructura
app/                            Next.js App Router
  (authenticated)/              Rutas protegidas (sidebar layout)
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
  lib/auth.ts                   getAuthUser() helper
  http.ts                       HTTP Actions (API + MCP)
proxy.ts                        Clerk auth proxy (raíz)
docs/                           Documentación del producto (specs, etc.)
```

### 25. README.md

Crear `README.md`:
```markdown
# Fractik

Meta-development platform for AI-assisted software engineering.

## Quick Start

### Prerequisites
- Node.js 22+ (use nvm: `nvm use`)
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)

### Setup
1. Clone: `git clone git@github.com:g-meta-tech/fractik.git`
2. Install: `pnpm install`
3. Copy env: `cp .env.example .env.local`
4. Fill in Clerk and Convex keys in `.env.local`
5. Start: `pnpm dev`

### Environment Variables
See `.env.example` for required variables.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- Convex (backend, real-time DB)
- Clerk v7 (auth, multi-tenancy)
- Shadcn/ui v4 + Tailwind CSS
- Vercel (deploy)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js + Convex dev servers |
| `pnpm build` | Production build (deploys Convex if key is set) |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |

## Project Structure

See `CLAUDE.md` for full structure and conventions.
```

### 26. Directorio docs

```bash
mkdir -p docs
```

Crear `docs/README.md`:
```markdown
# Fractik - Product Documentation

This directory contains product specs and documentation.

## Current Status
Scaffolding complete. Next: Sprint Core (data model, CRUD, HTTP Actions, MCP Server).

## Adding Specs
Place spec files here:
docs/
  specs/
    DA-001-data-model.md
    BE-001-crud-functions.md

Claude Code reads specs from this directory to implement features.
After Sprint Core (MCP Server), this data migrates into Fractik itself.
```

### 27. Verificación

```bash
pnpm typecheck
pnpm lint
pnpm build
```

> Los tres deben pasar sin errores ni warnings (excepto el deprecation notice de proxy.ts).

### 28. Push

```bash
git add .
git commit -m "chore: initial scaffolding - next.js 16 + convex + clerk v7 + shadcn v4"
git remote add origin git@github.com:g-meta-tech/fractik.git
git branch -M main
git push -u origin main
git checkout -b dev
git push -u origin dev
```

---

## PARTE 2: PASOS MANUALES POST-PUSH (humano)

### Paso M5: Vercel (10 min)

**M5a:** vercel.com → Add New Project → Import `g-meta-tech/fractik` → Deploy

**M5b:** Project Settings → Environment Variables:

**Production:**
```
NEXT_PUBLIC_CONVEX_URL              = [Convex PRODUCCIÓN URL]
CONVEX_DEPLOY_KEY                   = [Convex prod deploy key]
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   = [pk_live_...]
CLERK_SECRET_KEY                    = [sk_live_...]
CLERK_JWT_ISSUER_DOMAIN             = [issuer producción]
```

**Preview:**
```
NEXT_PUBLIC_CONVEX_URL              = [Convex DEVELOPMENT URL]
CONVEX_DEPLOY_KEY                   = [Convex dev deploy key]
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   = [pk_test_...]
CLERK_SECRET_KEY                    = [sk_test_...]
CLERK_JWT_ISSUER_DOMAIN             = [issuer development]
```

- [ ] Redeploy para que tome las variables

### Paso M6: Custom domain (5 min)

- [ ] DNS: CNAME `fractik.g-meta.tech` → `cname.vercel-dns.com`
- [ ] Verificar: `nslookup fractik.g-meta.tech` (esperar que resuelva)
- [ ] Vercel → Domains → agregar `fractik.g-meta.tech`
- [ ] Clerk → Domains → agregar a allowed origins

### Paso M7: GitHub Actions (2 min)

- [ ] **Variables:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] **Secrets:** `CONVEX_DEPLOY_KEY`

### Paso M8: Branch protection (2 min)

- [ ] `main`: require PR (1 approval) + status check `Code Quality` + no force push + no delete
- [ ] `dev`: status check `Code Quality` + no force push

---

## PARTE 3: VALIDACIÓN

### Dev local
- [ ] `pnpm dev` arranca sin errores
- [ ] Landing page visible, "Iniciar" funciona
- [ ] Si loggeado, `/` redirige a `/dashboard`
- [ ] Sign up → crea cuenta + org → dashboard
- [ ] Sidebar: org switcher, collapse/expand persiste, dark/light mode
- [ ] Mobile (< 768px): sidebar como sheet overlay
- [ ] Ruta protegida sin session → `/sign-in`
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm build` pasan limpio
- [ ] No errores de consola (especialmente no "asChild" ni "nativeButton")

### CI/CD
- [ ] Push a main → Vercel auto-deploy a producción
- [ ] Push a dev/feature branch → Vercel preview URL
- [ ] PR a main o dev → GitHub Actions CI corre
- [ ] CI reporta status check en el PR
- [ ] Error TypeScript intencional → CI falla (verificar que bloquea)

### Producción
- [ ] `fractik.g-meta.tech` carga la landing page
- [ ] Auth funciona end-to-end (sign up, login, org)
- [ ] Org switcher funciona
- [ ] Dark/light mode funciona
- [ ] Convex dashboard muestra deployment de producción conectado

---

## Qué sigue (Sprint Core)

Con el scaffolding completo, el siguiente paso es implementar el Sprint Core:
- DA-001: Data Model en Convex (projects, capabilities, features, specs, tests, apiKeys)
- NF-001: Auth pattern completo con getAuthUser()
- BE-001 a BE-005: CRUD functions, HTTP Actions, MCP Server

Los specs se colocarán en `/docs/specs/` y Claude Code los leerá para implementar.
