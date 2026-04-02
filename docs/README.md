# Fractik - Product Documentation

This directory contains product specs and documentation for Fractik.

## Current Status

Fractik is in the **scaffolding phase**. The infrastructure is set up:

- Next.js 16 + Convex + Clerk + Shadcn
- Auth with multi-tenancy (Clerk organizations)
- CI/CD pipeline (GitHub Actions + Vercel auto-deploy)
- Production live at fractik.g-meta.tech

## What's Next: Sprint Core

The next phase will implement the core data model and APIs:

- **DA-001:** Data model in Convex (projects, capabilities, features, specs, tests, apiKeys)
- **NF-001:** Auth pattern with getAuthUser()
- **BE-001 to BE-005:** CRUD functions, HTTP Actions, MCP Server

## How This Directory Works

Specs and product documents live here temporarily. Once the Sprint Core is complete (MCP Server operational), this data will be loaded into Fractik itself and this directory will no longer be the source of truth.

### Adding Specs

Place spec files here following this convention:

```
docs/
  specs/
    DA-001-data-model.md
    NF-001-auth-pattern.md
    BE-001-crud-functions.md
    ...
```

Claude Code reads specs from this directory to implement features.
