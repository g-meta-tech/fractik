# Fractik - Product Documentation

This directory contains product specs and documentation for Fractik.

## Current Status

Scaffolding and Sprint Core are complete. The platform has:

- Next.js 16 + Convex + Clerk + Shadcn
- Auth with multi-tenancy (Clerk organizations)
- CI/CD pipeline (GitHub Actions + Vercel auto-deploy)
- Production live at fractik.g-meta.tech
- Full data layer (18 tables, CRUD functions, HTTP Actions, MCP Server, API keys)

## Completed

Implemented context packages are archived in `docs/completed/`:

- **FRACTIK-SCAFFOLDING-v3.md** — Infrastructure, auth, CI/CD, UI shell
- **CONTEXT-SPRINT-CORE.md** — Data model, CRUD, HTTP Actions, MCP Server

## How This Directory Works

Context packages are placed here for Claude Code to implement. Once implemented, they move to `completed/`.

```
docs/
  CONTEXT-{name}.md             Active context packages (pending implementation)
  completed/                    Implemented context packages (reference only)
```

Claude Code reads context packages from this directory to implement features.
