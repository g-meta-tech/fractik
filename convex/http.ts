import { httpRouter } from "convex/server";
import { httpAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

// ─── Helpers ─────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errorResponse(error: string, status: number) {
  return jsonResponse({ error }, status);
}

interface AuthResult {
  orgId: string;
  userId: string;
}

async function validateApiKeyAsync(
  ctx: ActionCtx,
  request: Request,
): Promise<AuthResult | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const key = header.slice(7);

  // Skip tokens that look like Clerk OAuth tokens (not API keys)
  if (!key.startsWith("fk_live_")) return null;

  // Hash with Web Crypto API (available in Convex default runtime)
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedKey = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const result = await ctx.runQuery(internal.apiKeys.validate, { hashedKey }) as { orgId: string; userId: string; keyId: Id<"apiKeys"> } | null;
  if (!result) return null;

  await ctx.runMutation(internal.apiKeys.touchLastUsed, { keyId: result.keyId });

  return result;
}

async function validateClerkOAuthToken(
  request: Request,
): Promise<AuthResult | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);

  // Skip API keys
  if (token.startsWith("fk_live_")) return null;

  const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
  if (!clerkDomain) return null;

  try {
    const response = await fetch(`${clerkDomain}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const userinfo = (await response.json()) as Record<string, unknown>;
    const userId = userinfo.sub as string | undefined;
    if (!userId) return null;

    // org_id comes from Clerk's OAuth scope when org is selected
    const orgId = userinfo.org_id as string | undefined;
    if (!orgId) {
      // Try to get the user's active org via Clerk Backend API
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) return null;

      const userResponse = await fetch(
        `https://api.clerk.com/v1/users/${userId}/organization_memberships?limit=1`,
        { headers: { Authorization: `Bearer ${clerkSecretKey}` } },
      );
      if (!userResponse.ok) return null;

      const memberships = (await userResponse.json()) as {
        data: Array<{ organization: { id: string } }>;
      };
      const firstOrg = memberships.data[0];
      if (!firstOrg) return null;

      return { userId, orgId: firstOrg.organization.id };
    }

    return { userId, orgId };
  } catch {
    return null;
  }
}

async function authenticateRequest(
  ctx: ActionCtx,
  request: Request,
): Promise<AuthResult | null> {
  // Try API key first (CLI / Claude Desktop)
  const apiKeyAuth = await validateApiKeyAsync(ctx, request);
  if (apiKeyAuth) return apiKeyAuth;

  // Try Clerk OAuth token (Claude.ai web)
  const oauthAuth = await validateClerkOAuthToken(request);
  if (oauthAuth) return oauthAuth;

  return null;
}

// ─── REST API: Read endpoints (BE-026) ───────────────────

http.route({
  path: "/api/projects",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const projects = await ctx.runQuery(internal.projects.listByOrgInternal, {
      orgId: auth.orgId,
    });

    return jsonResponse({ data: projects, meta: { timestamp: Date.now() } });
  }),
});

http.route({
  path: "/api/specs/design-system",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const projectSlug = url.searchParams.get("project");
    if (!projectSlug) return errorResponse("Missing project parameter", 400);

    const project = await ctx.runQuery(internal.projects.getBySlugInternal, {
      orgId: auth.orgId,
      slug: projectSlug,
    });
    if (!project) return errorResponse("Not found", 404);

    const spec = await ctx.runQuery(internal.specs.getDesignSystem, {
      orgId: auth.orgId,
      projectId: project._id,
    });

    return jsonResponse({ data: spec, meta: { timestamp: Date.now() } });
  }),
});

http.route({
  path: "/api/specs/data-model",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const projectSlug = url.searchParams.get("project");
    if (!projectSlug) return errorResponse("Missing project parameter", 400);

    const project = await ctx.runQuery(internal.projects.getBySlugInternal, {
      orgId: auth.orgId,
      slug: projectSlug,
    });
    if (!project) return errorResponse("Not found", 404);

    const spec = await ctx.runQuery(internal.specs.getDataModel, {
      orgId: auth.orgId,
      projectId: project._id,
    });

    return jsonResponse({ data: spec, meta: { timestamp: Date.now() } });
  }),
});

http.route({
  path: "/api/library/specs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const specs = await ctx.runQuery(internal.library.listSpecsInternal, {
      orgId: auth.orgId,
    });

    return jsonResponse({ data: specs, meta: { timestamp: Date.now() } });
  }),
});

// ─── REST API: Write endpoints (BE-027) ──────────────────

http.route({
  path: "/api/divergences",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    if (!body.specId || !body.type || !body.description) {
      return errorResponse("Missing required fields: specId, type, description", 400);
    }

    try {
      const id = await ctx.runMutation(internal.divergences.createInternal, {
        orgId: auth.orgId,
        userId: auth.userId,
        specId: body.specId as Id<"specs">,
        sprintId: body.sprintId as Id<"sprints"> | undefined,
        type: body.type,
        description: body.description,
      });
      return jsonResponse({ data: { id }, meta: { timestamp: Date.now() } }, 201);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return errorResponse(message, 400);
    }
  }),
});

// ─── Dynamic routes via catch-all patterns ───────────────
// Convex HTTP routes are exact paths, so we register specific patterns.

// GET /api/projects/:slug/tree
http.route({
  path: "/api/tree",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const slug = url.searchParams.get("project");
    if (!slug) return errorResponse("Missing project parameter", 400);

    const tree = await ctx.runQuery(internal.projects.getProjectTree, {
      orgId: auth.orgId,
      slug,
    });

    if (!tree) return errorResponse("Not found", 404);
    return jsonResponse({ data: tree, meta: { timestamp: Date.now() } });
  }),
});

// GET /api/specs?id=:specId
http.route({
  path: "/api/specs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const specId = url.searchParams.get("id");
    if (!specId) return errorResponse("Missing id parameter", 400);

    const spec = await ctx.runQuery(internal.specs.getInternal, {
      orgId: auth.orgId,
      specId: specId as Id<"specs">,
    });
    if (!spec) return errorResponse("Not found", 404);

    const tests = await ctx.runQuery(internal.testCases.listBySpecInternal, {
      orgId: auth.orgId,
      specId: specId as Id<"specs">,
    });

    return jsonResponse({
      data: { ...spec, testCases: tests },
      meta: { timestamp: Date.now() },
    });
  }),
});

// GET /api/spec-versions?specId=:specId
http.route({
  path: "/api/spec-versions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const specId = url.searchParams.get("specId");
    if (!specId) return errorResponse("Missing specId parameter", 400);

    const spec = await ctx.runQuery(internal.specs.getInternal, {
      orgId: auth.orgId,
      specId: specId as Id<"specs">,
    });
    if (!spec) return errorResponse("Not found", 404);

    const versions = await ctx.runQuery(internal.specVersions.listBySpecInternal, {
      orgId: auth.orgId,
      specId: specId as Id<"specs">,
    });

    return jsonResponse({ data: versions, meta: { timestamp: Date.now() } });
  }),
});

// PATCH /api/specs/status
http.route({
  path: "/api/specs/status",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    if (!body.specId || !body.status) {
      return errorResponse("Missing required fields: specId, status", 400);
    }

    try {
      await ctx.runMutation(internal.specs.updateStatusInternal, {
        orgId: auth.orgId,
        specId: body.specId as Id<"specs">,
        status: body.status,
      });
      return jsonResponse({ data: { success: true }, meta: { timestamp: Date.now() } });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return errorResponse(message, 400);
    }
  }),
});

// PATCH /api/tests/status
http.route({
  path: "/api/tests/status",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    if (!body.testCaseId || !body.status) {
      return errorResponse("Missing required fields: testCaseId, status", 400);
    }

    try {
      await ctx.runMutation(internal.testCases.updateStatusInternal, {
        orgId: auth.orgId,
        userId: auth.userId,
        testCaseId: body.testCaseId as Id<"testCases">,
        status: body.status,
        note: body.note,
      });
      return jsonResponse({ data: { success: true }, meta: { timestamp: Date.now() } });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return errorResponse(message, 400);
    }
  }),
});

// POST /api/sprints/log
http.route({
  path: "/api/sprints/log",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    if (!body.sprintId || !body.type || !body.content) {
      return errorResponse("Missing required fields: sprintId, type, content", 400);
    }

    try {
      const id = await ctx.runMutation(internal.sprints.addLogEntryInternal, {
        orgId: auth.orgId,
        userId: auth.userId,
        sprintId: body.sprintId as Id<"sprints">,
        type: body.type,
        content: body.content,
      });
      return jsonResponse({ data: { id }, meta: { timestamp: Date.now() } }, 201);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return errorResponse(message, 400);
    }
  }),
});

// POST /api/sprints/defects
http.route({
  path: "/api/sprints/defects",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    if (!body.sprintId || !body.specId || !body.title || !body.description || !body.severity) {
      return errorResponse(
        "Missing required fields: sprintId, specId, title, description, severity",
        400,
      );
    }

    try {
      const id = await ctx.runMutation(internal.sprints.addDefectInternal, {
        orgId: auth.orgId,
        userId: auth.userId,
        sprintId: body.sprintId as Id<"sprints">,
        specId: body.specId as Id<"specs">,
        title: body.title,
        description: body.description,
        severity: body.severity,
      });
      return jsonResponse({ data: { id }, meta: { timestamp: Date.now() } }, 201);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return errorResponse(message, 400);
    }
  }),
});

// GET /api/coverage?project=:slug
http.route({
  path: "/api/coverage",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const slug = url.searchParams.get("project");
    if (!slug) return errorResponse("Missing project parameter", 400);

    const tree = await ctx.runQuery(internal.projects.getProjectTree, {
      orgId: auth.orgId,
      slug,
    });
    if (!tree) return errorResponse("Not found", 404);

    let totalSpecs = 0;
    let specsWithTests = 0;
    let totalTests = 0;
    let passingTests = 0;

    for (const cap of tree.capabilities) {
      for (const feat of cap.features) {
        for (const spec of feat.specs) {
          totalSpecs++;
          if (spec.testCases.length > 0) specsWithTests++;
          totalTests += spec.testCases.length;
          passingTests += spec.testCases.filter(
            (t: { status: string }) => t.status === "passing",
          ).length;
        }
      }
    }

    return jsonResponse({
      data: {
        totalSpecs,
        specsWithTests,
        testCoverage: totalSpecs > 0 ? Math.round((specsWithTests / totalSpecs) * 100) : 0,
        totalTests,
        passingTests,
        passRate: totalTests > 0 ? Math.round((passingTests / totalTests) * 100) : 0,
      },
      meta: { timestamp: Date.now() },
    });
  }),
});

// GET /api/gaps?project=:slug
http.route({
  path: "/api/gaps",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const slug = url.searchParams.get("project");
    if (!slug) return errorResponse("Missing project parameter", 400);

    const tree = await ctx.runQuery(internal.projects.getProjectTree, {
      orgId: auth.orgId,
      slug,
    });
    if (!tree) return errorResponse("Not found", 404);

    const gaps: Array<{
      type: string;
      path: string;
      message: string;
    }> = [];

    for (const cap of tree.capabilities) {
      if (cap.features.length === 0) {
        gaps.push({
          type: "no_features",
          path: `${tree.name} > ${cap.name}`,
          message: `Capability "${cap.name}" has no features`,
        });
      }

      for (const feat of cap.features) {
        if (feat.specs.length === 0) {
          gaps.push({
            type: "no_specs",
            path: `${tree.name} > ${cap.name} > ${feat.name}`,
            message: `Feature "${feat.name}" has no specs`,
          });
        }

        for (const spec of feat.specs) {
          if (spec.testCases.length === 0) {
            gaps.push({
              type: "no_tests",
              path: `${tree.name} > ${cap.name} > ${feat.name} > ${spec.title}`,
              message: `Spec "${spec.title}" has no test cases`,
            });
          }
        }

        if (feat.userStories.length === 0) {
          gaps.push({
            type: "no_stories",
            path: `${tree.name} > ${cap.name} > ${feat.name}`,
            message: `Feature "${feat.name}" has no user stories`,
          });
        }
      }
    }

    return jsonResponse({ data: gaps, meta: { timestamp: Date.now() } });
  }),
});

// ─── OAuth for MCP (Clerk as IdP) ────────────────────────

http.route({
  path: "/.well-known/oauth-authorization-server",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = new URL(request.url).origin;
    const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

    if (!clerkDomain) {
      return errorResponse("OAuth not configured", 500);
    }

    return jsonResponse({
      issuer: origin,
      authorization_endpoint: `${clerkDomain}/oauth/authorize`,
      token_endpoint: `${clerkDomain}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
    });
  }),
});

http.route({
  path: "/oauth/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as { redirect_uris?: string[] };

    const clientId = process.env.CLERK_OAUTH_CLIENT_ID;
    const clientSecret = process.env.CLERK_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return errorResponse("OAuth not configured. Set CLERK_OAUTH_CLIENT_ID and CLERK_OAUTH_CLIENT_SECRET.", 500);
    }

    return jsonResponse({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: body.redirect_uris ?? [],
      token_endpoint_auth_method: "client_secret_post",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  }),
});

// ─── MCP Server (BE-028) ────────────────────────────────

http.route({
  path: "/mcp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth) {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized" },
          id: null,
        },
        401,
      );
    }

    const body = await request.json();
    const { method, params, id } = body;

    try {
      switch (method) {
        case "initialize": {
          return jsonResponse({
            jsonrpc: "2.0",
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "fractik", version: "1.0.0" },
            },
            id,
          });
        }

        case "notifications/initialized": {
          return jsonResponse({ jsonrpc: "2.0", result: {}, id });
        }

        case "tools/list": {
          return jsonResponse({
            jsonrpc: "2.0",
            result: {
              tools: [
                {
                  name: "query_project",
                  description: "Get project tree with capabilities, features, specs, and tests",
                  inputSchema: {
                    type: "object",
                    properties: { slug: { type: "string", description: "Project slug" } },
                    required: ["slug"],
                  },
                },
                {
                  name: "get_spec",
                  description: "Get a spec by ID with its content and test cases",
                  inputSchema: {
                    type: "object",
                    properties: { specId: { type: "string", description: "Spec ID" } },
                    required: ["specId"],
                  },
                },
                {
                  name: "get_gaps",
                  description: "Detect gaps in project coverage (missing specs, tests, stories)",
                  inputSchema: {
                    type: "object",
                    properties: { slug: { type: "string", description: "Project slug" } },
                    required: ["slug"],
                  },
                },
                {
                  name: "get_coverage",
                  description: "Get test coverage stats for a project",
                  inputSchema: {
                    type: "object",
                    properties: { slug: { type: "string", description: "Project slug" } },
                    required: ["slug"],
                  },
                },
                {
                  name: "get_design_system",
                  description: "Get the Design System spec for a project",
                  inputSchema: {
                    type: "object",
                    properties: { slug: { type: "string", description: "Project slug" } },
                    required: ["slug"],
                  },
                },
                {
                  name: "get_data_model",
                  description: "Get the Data Model spec for a project",
                  inputSchema: {
                    type: "object",
                    properties: { slug: { type: "string", description: "Project slug" } },
                    required: ["slug"],
                  },
                },
                {
                  name: "get_spec_versions",
                  description: "Get version history for a spec",
                  inputSchema: {
                    type: "object",
                    properties: { specId: { type: "string", description: "Spec ID" } },
                    required: ["specId"],
                  },
                },
                {
                  name: "query_library",
                  description: "List library specs available to the organization",
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
                {
                  name: "update_spec_status",
                  description: "Update the status of a spec",
                  inputSchema: {
                    type: "object",
                    properties: {
                      specId: { type: "string", description: "Spec ID" },
                      status: {
                        type: "string",
                        enum: ["draft", "reviewed", "approved", "implemented", "deprecated"],
                      },
                    },
                    required: ["specId", "status"],
                  },
                },
                {
                  name: "update_test_status",
                  description: "Update the status of a test case",
                  inputSchema: {
                    type: "object",
                    properties: {
                      testId: { type: "string", description: "Test case ID" },
                      status: {
                        type: "string",
                        enum: ["defined", "passing", "failing", "skipped", "blocked"],
                      },
                      note: { type: "string", description: "Optional note" },
                    },
                    required: ["testId", "status"],
                  },
                },
                {
                  name: "add_log_entry",
                  description: "Add a log entry to a sprint",
                  inputSchema: {
                    type: "object",
                    properties: {
                      sprintId: { type: "string", description: "Sprint ID" },
                      type: {
                        type: "string",
                        enum: ["progress", "note", "blocker", "defect"],
                      },
                      content: { type: "string", description: "Log content" },
                    },
                    required: ["sprintId", "type", "content"],
                  },
                },
                {
                  name: "report_divergence",
                  description: "Report a divergence between spec and implementation",
                  inputSchema: {
                    type: "object",
                    properties: {
                      specId: { type: "string", description: "Spec ID" },
                      type: {
                        type: "string",
                        enum: ["deviation", "enhancement", "issue"],
                      },
                      description: { type: "string", description: "Description of the divergence" },
                    },
                    required: ["specId", "type", "description"],
                  },
                },
                {
                  name: "create_project",
                  description: "Create a new project in the organization",
                  inputSchema: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Project name" },
                      description: { type: "string", description: "Project description" },
                    },
                    required: ["name"],
                  },
                },
                {
                  name: "create_capability",
                  description: "Create a capability under a project",
                  inputSchema: {
                    type: "object",
                    properties: {
                      projectId: { type: "string", description: "Project ID" },
                      name: { type: "string", description: "Capability name" },
                      description: { type: "string", description: "Capability description" },
                    },
                    required: ["projectId", "name"],
                  },
                },
                {
                  name: "create_feature",
                  description: "Create a feature under a capability",
                  inputSchema: {
                    type: "object",
                    properties: {
                      capabilityId: { type: "string", description: "Capability ID" },
                      name: { type: "string", description: "Feature name" },
                      description: { type: "string", description: "Feature description" },
                      acceptanceCriteria: {
                        type: "array",
                        items: { type: "string" },
                        description: "Acceptance criteria as list of strings",
                      },
                    },
                    required: ["capabilityId", "name"],
                  },
                },
                {
                  name: "update_feature",
                  description: "Update a feature's name, description, status, or acceptance criteria",
                  inputSchema: {
                    type: "object",
                    properties: {
                      featureId: { type: "string", description: "Feature ID" },
                      name: { type: "string", description: "New feature name" },
                      description: { type: "string", description: "New feature description" },
                      status: {
                        type: "string",
                        enum: ["draft", "defined", "spec_ready", "in_progress", "done"],
                        description: "New feature status",
                      },
                      acceptanceCriteria: {
                        type: "array",
                        items: { type: "string" },
                        description: "Acceptance criteria as list of strings (replaces existing)",
                      },
                    },
                    required: ["featureId"],
                  },
                },
                {
                  name: "update_project",
                  description: "Update a project's name, description, GitHub repo URL, or visibility",
                  inputSchema: {
                    type: "object",
                    properties: {
                      projectSlug: { type: "string", description: "Project slug" },
                      name: { type: "string", description: "New project name" },
                      description: { type: "string", description: "New project description" },
                      githubRepoUrl: { type: "string", description: "GitHub repository URL" },
                      isPublic: { type: "boolean", description: "Toggle project visibility" },
                    },
                    required: ["projectSlug"],
                  },
                },
                {
                  name: "create_user_story",
                  description: "Create a user story under a feature. Format: As a [persona], I want to [action] so that [benefit]",
                  inputSchema: {
                    type: "object",
                    properties: {
                      featureId: { type: "string", description: "Feature ID" },
                      persona: { type: "string", description: "User persona (e.g. 'product manager')" },
                      action: { type: "string", description: "What the user wants to do" },
                      benefit: { type: "string", description: "Why they want to do it" },
                      acceptanceCriteria: {
                        type: "array",
                        items: { type: "string" },
                        description: "Acceptance criteria as list of strings",
                      },
                    },
                    required: ["featureId", "persona", "action", "benefit"],
                  },
                },
                {
                  name: "create_spec",
                  description: "Create a spec under a feature",
                  inputSchema: {
                    type: "object",
                    properties: {
                      featureId: { type: "string", description: "Feature ID" },
                      type: { type: "string", enum: ["NF", "BE", "FE", "DA"], description: "Spec type: NF=Non-functional, BE=Backend, FE=Frontend, DA=Data" },
                      title: { type: "string", description: "Spec title" },
                      content: { type: "string", description: "Spec content in markdown" },
                    },
                    required: ["featureId", "type", "title"],
                  },
                },
                {
                  name: "create_test_case",
                  description: "Create a test case for a spec",
                  inputSchema: {
                    type: "object",
                    properties: {
                      specId: { type: "string", description: "Spec ID" },
                      type: { type: "string", enum: ["unit", "integration", "e2e", "manual"], description: "Test type" },
                      title: { type: "string", description: "Test case title" },
                      preconditions: { type: "string", description: "Preconditions for the test" },
                    },
                    required: ["specId", "type", "title"],
                  },
                },
                {
                  name: "update_vision",
                  description: "Update the vision content of a project",
                  inputSchema: {
                    type: "object",
                    properties: {
                      projectSlug: { type: "string", description: "Project slug" },
                      content: { type: "string", description: "New vision content in markdown" },
                      changeNote: { type: "string", description: "Note describing the change" },
                    },
                    required: ["projectSlug", "content"],
                  },
                },
                {
                  name: "update_spec_content",
                  description: "Update the content of a spec (creates a version)",
                  inputSchema: {
                    type: "object",
                    properties: {
                      specId: { type: "string", description: "Spec ID" },
                      content: { type: "string", description: "New spec content in markdown" },
                      changeNote: { type: "string", description: "Note describing the change" },
                    },
                    required: ["specId", "content"],
                  },
                },
                {
                  name: "update_capability",
                  description: "Update a capability's name, description, priority, or status",
                  inputSchema: {
                    type: "object",
                    properties: {
                      capabilityId: { type: "string", description: "Capability ID" },
                      name: { type: "string", description: "New capability name" },
                      description: { type: "string", description: "New capability description" },
                      priority: {
                        type: "string",
                        enum: ["critical", "high", "medium", "low"],
                        description: "New priority level",
                      },
                      status: {
                        type: "string",
                        enum: ["draft", "defined", "in_progress", "done"],
                        description: "New status",
                      },
                    },
                    required: ["capabilityId"],
                  },
                },
                {
                  name: "update_user_story",
                  description: "Update a user story's persona, action, benefit, or criteria",
                  inputSchema: {
                    type: "object",
                    properties: {
                      storyId: { type: "string", description: "User Story ID" },
                      persona: { type: "string", description: "User persona" },
                      action: { type: "string", description: "What the user wants to do" },
                      benefit: { type: "string", description: "Why they want to do it" },
                      criteria: {
                        type: "array",
                        items: { type: "string" },
                        description: "Acceptance criteria as list of strings (replaces existing)",
                      },
                    },
                    required: ["storyId"],
                  },
                },
                {
                  name: "update_test_case",
                  description: "Update a test case's title, preconditions, or steps",
                  inputSchema: {
                    type: "object",
                    properties: {
                      testCaseId: { type: "string", description: "Test Case ID" },
                      title: { type: "string", description: "New test case title" },
                      preconditions: { type: "string", description: "New preconditions" },
                      steps: {
                        type: "string",
                        description: "JSON array of steps: [{\"action\":\"...\",\"expectedResult\":\"...\"},...]",
                      },
                    },
                    required: ["testCaseId"],
                  },
                },
                {
                  name: "get_project",
                  description: "Get project metadata with stats (complementary to query_project which returns full tree)",
                  inputSchema: {
                    type: "object",
                    properties: {
                      slug: { type: "string", description: "Project slug" },
                    },
                    required: ["slug"],
                  },
                },
                {
                  name: "get_feature",
                  description: "Get a feature with its acceptance criteria, user stories, specs, and test summary",
                  inputSchema: {
                    type: "object",
                    properties: {
                      featureId: { type: "string", description: "Feature ID" },
                    },
                    required: ["featureId"],
                  },
                },
                {
                  name: "get_capability",
                  description: "Get a capability with its features summary",
                  inputSchema: {
                    type: "object",
                    properties: {
                      capabilityId: { type: "string", description: "Capability ID" },
                    },
                    required: ["capabilityId"],
                  },
                },
                {
                  name: "create_sprint",
                  description: "Create a sprint for a project with name and date range",
                  inputSchema: {
                    type: "object",
                    properties: {
                      projectSlug: { type: "string", description: "Project slug" },
                      name: { type: "string", description: "Sprint name" },
                      startDate: { type: "string", description: "Start date (ISO format, e.g. 2026-04-03)" },
                      endDate: { type: "string", description: "End date (ISO format, e.g. 2026-04-10)" },
                    },
                    required: ["projectSlug", "name", "startDate", "endDate"],
                  },
                },
                {
                  name: "add_sprint_item",
                  description: "Add a spec or test case to a sprint as a work item",
                  inputSchema: {
                    type: "object",
                    properties: {
                      sprintId: { type: "string", description: "Sprint ID" },
                      entityType: { type: "string", enum: ["spec", "test"], description: "Type of entity" },
                      entityId: { type: "string", description: "Spec or Test Case ID" },
                    },
                    required: ["sprintId", "entityType", "entityId"],
                  },
                },
              ],
            },
            id,
          });
        }

        case "tools/call": {
          const toolName = params?.name;
          const toolArgs = params?.arguments ?? {};

          switch (toolName) {
            case "query_project": {
              const tree = await ctx.runQuery(internal.projects.getProjectTree, {
                orgId: auth.orgId,
                slug: toolArgs.slug,
              });
              if (!tree) {
                return mcpToolResult(id, `Project "${toolArgs.slug}" not found`, true);
              }
              return mcpToolResult(id, formatProjectTree(tree));
            }

            case "get_spec": {
              const spec = await ctx.runQuery(internal.specs.getInternal, {
                orgId: auth.orgId,
                specId: toolArgs.specId as Id<"specs">,
              });
              if (!spec) return mcpToolResult(id, "Spec not found", true);

              const tests = await ctx.runQuery(internal.testCases.listBySpecInternal, {
                orgId: auth.orgId,
                specId: toolArgs.specId as Id<"specs">,
              });

              const lines = [
                `# ${spec.title}`,
                `Type: ${spec.type} | Status: ${spec.status} | Version: ${spec.versionNumber}`,
                "",
                spec.content,
              ];
              if (spec.technicalNotes) lines.push("", "## Technical Notes", spec.technicalNotes);
              if (spec.constraints) lines.push("", "## Constraints", spec.constraints);
              if (spec.dependencies) lines.push("", "## Dependencies", spec.dependencies);
              if (tests.length > 0) {
                lines.push("", `## Test Cases (${tests.length})`);
                for (const t of tests) {
                  lines.push(`- [${t.status}] ${t.title} (${t.type})`);
                }
              }
              return mcpToolResult(id, lines.join("\n"));
            }

            case "get_gaps": {
              const tree = await ctx.runQuery(internal.projects.getProjectTree, {
                orgId: auth.orgId,
                slug: toolArgs.slug,
              });
              if (!tree) return mcpToolResult(id, `Project "${toolArgs.slug}" not found`, true);

              const gaps = detectGaps(tree);
              if (gaps.length === 0) {
                return mcpToolResult(id, "No gaps detected. Full coverage!");
              }
              const lines = [`Found ${gaps.length} gap(s):`, ""];
              for (const gap of gaps) {
                lines.push(`- [${gap.type}] ${gap.path}: ${gap.message}`);
              }
              return mcpToolResult(id, lines.join("\n"));
            }

            case "get_coverage": {
              const tree = await ctx.runQuery(internal.projects.getProjectTree, {
                orgId: auth.orgId,
                slug: toolArgs.slug,
              });
              if (!tree) return mcpToolResult(id, `Project "${toolArgs.slug}" not found`, true);

              const stats = computeCoverage(tree);
              return mcpToolResult(
                id,
                [
                  `Test Coverage for ${tree.name}:`,
                  `  Specs: ${stats.totalSpecs}`,
                  `  Specs with tests: ${stats.specsWithTests} (${stats.testCoverage}%)`,
                  `  Total tests: ${stats.totalTests}`,
                  `  Passing: ${stats.passingTests} (${stats.passRate}%)`,
                ].join("\n"),
              );
            }

            case "get_design_system": {
              const project = await ctx.runQuery(internal.projects.getBySlugInternal, {
                orgId: auth.orgId,
                slug: toolArgs.slug,
              });
              if (!project) return mcpToolResult(id, "Project not found", true);

              const spec = await ctx.runQuery(internal.specs.getDesignSystem, {
                orgId: auth.orgId,
                projectId: project._id,
              });
              if (!spec) return mcpToolResult(id, "No Design System spec found");
              return mcpToolResult(id, `# ${spec.title}\n\n${spec.content}`);
            }

            case "get_data_model": {
              const project = await ctx.runQuery(internal.projects.getBySlugInternal, {
                orgId: auth.orgId,
                slug: toolArgs.slug,
              });
              if (!project) return mcpToolResult(id, "Project not found", true);

              const spec = await ctx.runQuery(internal.specs.getDataModel, {
                orgId: auth.orgId,
                projectId: project._id,
              });
              if (!spec) return mcpToolResult(id, "No Data Model spec found");
              return mcpToolResult(id, `# ${spec.title}\n\n${spec.content}`);
            }

            case "get_spec_versions": {
              const versions = await ctx.runQuery(internal.specVersions.listBySpecInternal, {
                orgId: auth.orgId,
                specId: toolArgs.specId as Id<"specs">,
              });
              if (versions.length === 0) return mcpToolResult(id, "No versions found");

              const lines = ["Version history:", ""];
              for (const ver of versions) {
                lines.push(
                  `v${ver.versionNumber} - ${new Date(ver.changedAt).toISOString()} - ${ver.changeNote || "(no note)"}`,
                );
              }
              return mcpToolResult(id, lines.join("\n"));
            }

            case "query_library": {
              const specs = await ctx.runQuery(internal.library.listSpecsInternal, {
                orgId: auth.orgId,
              });
              if (specs.length === 0) return mcpToolResult(id, "No library specs found");

              const lines = ["Library specs:", ""];
              for (const s of specs) {
                lines.push(`- [${s.type}] ${s.title} (${s.visibility})`);
              }
              return mcpToolResult(id, lines.join("\n"));
            }

            case "update_spec_status": {
              try {
                await ctx.runMutation(internal.specs.updateStatusInternal, {
                  orgId: auth.orgId,
                  specId: toolArgs.specId as Id<"specs">,
                  status: toolArgs.status,
                });
                return mcpToolResult(id, `Spec status updated to "${toolArgs.status}"`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_test_status": {
              try {
                await ctx.runMutation(internal.testCases.updateStatusInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  testCaseId: toolArgs.testId as Id<"testCases">,
                  status: toolArgs.status,
                  note: toolArgs.note,
                });
                return mcpToolResult(id, `Test status updated to "${toolArgs.status}"`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "add_log_entry": {
              try {
                await ctx.runMutation(internal.sprints.addLogEntryInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  sprintId: toolArgs.sprintId as Id<"sprints">,
                  type: toolArgs.type,
                  content: toolArgs.content,
                });
                return mcpToolResult(id, "Log entry added");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "report_divergence": {
              try {
                await ctx.runMutation(internal.divergences.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  specId: toolArgs.specId as Id<"specs">,
                  type: toolArgs.type,
                  description: toolArgs.description,
                });
                return mcpToolResult(id, "Divergence reported");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "create_project": {
              try {
                const projectId = await ctx.runMutation(internal.projects.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  name: toolArgs.name,
                  description: toolArgs.description,
                });
                return mcpToolResult(id, `Project created with ID: ${projectId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "create_capability": {
              try {
                const capId = await ctx.runMutation(internal.capabilities.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  projectId: toolArgs.projectId as Id<"projects">,
                  name: toolArgs.name,
                  description: toolArgs.description,
                });
                return mcpToolResult(id, `Capability created with ID: ${capId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "create_feature": {
              try {
                const acStrings = toolArgs.acceptanceCriteria as string[] | undefined;
                const acObjects = acStrings?.map((text: string, i: number) => ({
                  id: `ac-${Date.now()}-${i}`,
                  text,
                  sortOrder: i,
                }));
                const featId = await ctx.runMutation(internal.features.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  capabilityId: toolArgs.capabilityId as Id<"capabilities">,
                  name: toolArgs.name,
                  description: toolArgs.description,
                  acceptanceCriteria: acObjects,
                });
                return mcpToolResult(id, `Feature created with ID: ${featId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_feature": {
              try {
                const acStrings = toolArgs.acceptanceCriteria as string[] | undefined;
                const acObjects = acStrings?.map((text: string, i: number) => ({
                  id: `ac-${Date.now()}-${i}`,
                  text,
                  sortOrder: i,
                }));
                await ctx.runMutation(internal.features.updateInternal, {
                  orgId: auth.orgId,
                  featureId: toolArgs.featureId as Id<"features">,
                  name: toolArgs.name,
                  description: toolArgs.description,
                  status: toolArgs.status,
                  acceptanceCriteria: acObjects,
                });
                return mcpToolResult(id, "Feature updated");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_project": {
              try {
                const project = await ctx.runQuery(internal.projects.getBySlugInternal, {
                  orgId: auth.orgId,
                  slug: toolArgs.projectSlug,
                });
                if (!project) return mcpToolResult(id, "Project not found", true);

                await ctx.runMutation(internal.projects.updateInternal, {
                  orgId: auth.orgId,
                  projectId: project._id,
                  name: toolArgs.name,
                  description: toolArgs.description,
                  githubRepoUrl: toolArgs.githubRepoUrl,
                  isPublic: toolArgs.isPublic,
                });
                return mcpToolResult(id, "Project updated");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "create_user_story": {
              try {
                const acStrings = toolArgs.acceptanceCriteria as string[] | undefined;
                const criteriaObjects = acStrings?.map((text: string, i: number) => ({
                  id: `cr-${Date.now()}-${i}`,
                  text,
                  sortOrder: i,
                }));
                const storyId = await ctx.runMutation(internal.userStories.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  featureId: toolArgs.featureId as Id<"features">,
                  persona: toolArgs.persona,
                  action: toolArgs.action,
                  benefit: toolArgs.benefit,
                  criteria: criteriaObjects,
                });
                return mcpToolResult(id, `User story created with ID: ${storyId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "create_spec": {
              try {
                const specId = await ctx.runMutation(internal.specs.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  featureId: toolArgs.featureId as Id<"features">,
                  type: toolArgs.type,
                  title: toolArgs.title,
                  content: toolArgs.content,
                });
                return mcpToolResult(id, `Spec created with ID: ${specId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "create_test_case": {
              try {
                const testId = await ctx.runMutation(internal.testCases.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  specId: toolArgs.specId as Id<"specs">,
                  type: toolArgs.type,
                  title: toolArgs.title,
                  preconditions: toolArgs.preconditions,
                });
                return mcpToolResult(id, `Test case created with ID: ${testId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_vision": {
              try {
                const project = await ctx.runQuery(internal.projects.getBySlugInternal, {
                  orgId: auth.orgId,
                  slug: toolArgs.projectSlug,
                });
                if (!project) return mcpToolResult(id, "Project not found", true);

                await ctx.runMutation(internal.projects.updateVisionInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  projectId: project._id,
                  content: toolArgs.content,
                  changeNote: toolArgs.changeNote,
                });
                return mcpToolResult(id, "Vision updated");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_spec_content": {
              try {
                await ctx.runMutation(internal.specs.updateContentInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  specId: toolArgs.specId as Id<"specs">,
                  content: toolArgs.content,
                  changeNote: toolArgs.changeNote,
                });
                return mcpToolResult(id, "Spec content updated (new version created)");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_capability": {
              try {
                await ctx.runMutation(internal.capabilities.updateInternal, {
                  orgId: auth.orgId,
                  capabilityId: toolArgs.capabilityId as Id<"capabilities">,
                  name: toolArgs.name,
                  description: toolArgs.description,
                  priority: toolArgs.priority,
                  status: toolArgs.status,
                });
                return mcpToolResult(id, "Capability updated");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_user_story": {
              try {
                const crStrings = toolArgs.criteria as string[] | undefined;
                const crObjects = crStrings?.map((text: string, i: number) => ({
                  id: `cr-${Date.now()}-${i}`,
                  text,
                  sortOrder: i,
                }));
                await ctx.runMutation(internal.userStories.updateInternal, {
                  orgId: auth.orgId,
                  storyId: toolArgs.storyId as Id<"userStories">,
                  persona: toolArgs.persona,
                  action: toolArgs.action,
                  benefit: toolArgs.benefit,
                  criteria: crObjects,
                });
                return mcpToolResult(id, "User story updated");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "update_test_case": {
              try {
                let stepsObjects: Array<{ id: string; action: string; expectedResult: string; sortOrder: number }> | undefined;
                if (toolArgs.steps) {
                  const parsed = JSON.parse(toolArgs.steps as string) as Array<{ action: string; expectedResult: string }>;
                  stepsObjects = parsed.map((step: { action: string; expectedResult: string }, i: number) => ({
                    id: `step-${Date.now()}-${i}`,
                    action: step.action,
                    expectedResult: step.expectedResult,
                    sortOrder: i,
                  }));
                }
                await ctx.runMutation(internal.testCases.updateInternal, {
                  orgId: auth.orgId,
                  testCaseId: toolArgs.testCaseId as Id<"testCases">,
                  title: toolArgs.title,
                  preconditions: toolArgs.preconditions,
                  steps: stepsObjects,
                });
                return mcpToolResult(id, "Test case updated");
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "get_project": {
              const meta = await ctx.runQuery(internal.projects.getMetaInternal, {
                orgId: auth.orgId,
                slug: toolArgs.slug,
              });
              if (!meta) return mcpToolResult(id, "Project not found", true);

              const lines = [
                `# ${meta.name}`,
                `Slug: ${meta.slug}`,
                `Description: ${meta.description}`,
                `GitHub: ${meta.githubRepoUrl ?? "(not set)"}`,
                `Public: ${meta.isPublic}`,
                `Vision version: ${meta.visionVersionNumber}`,
                "",
                "## Stats",
                `- Capabilities: ${meta.stats.capabilityCount}`,
                `- Features: ${meta.stats.featureCount}`,
                `- Specs: ${meta.stats.specCount}`,
                `- Test cases: ${meta.stats.testCount}`,
              ];
              return mcpToolResult(id, lines.join("\n"));
            }

            case "get_feature": {
              const detail = await ctx.runQuery(internal.features.getDetailedInternal, {
                orgId: auth.orgId,
                featureId: toolArgs.featureId as Id<"features">,
              });
              if (!detail) return mcpToolResult(id, "Feature not found", true);

              const lines = [
                `# ${detail.name} [${detail.status}]`,
                `ID: ${detail._id}`,
                detail.description ? `Description: ${detail.description}` : "",
                "",
              ];

              if (detail.acceptanceCriteria.length > 0) {
                lines.push(`## Acceptance Criteria (${detail.acceptanceCriteria.length})`);
                for (const [i, ac] of detail.acceptanceCriteria.entries()) {
                  lines.push(`${i + 1}. ${ac.text}`);
                }
                lines.push("");
              }

              if (detail.stories.length > 0) {
                lines.push(`## User Stories (${detail.stories.length})`);
                for (const story of detail.stories) {
                  lines.push(`- As a ${story.persona}, I want to ${story.action} so that ${story.benefit} (id: ${story._id})`);
                }
                lines.push("");
              }

              if (detail.specs.length > 0) {
                lines.push(`## Specs (${detail.specs.length})`);
                for (const spec of detail.specs) {
                  lines.push(`- [${spec.type}] ${spec.title} [${spec.status}] (${spec.testCount} tests) (id: ${spec._id})`);
                }
              }

              return mcpToolResult(id, lines.join("\n"));
            }

            case "get_capability": {
              const detail = await ctx.runQuery(internal.capabilities.getDetailedInternal, {
                orgId: auth.orgId,
                capabilityId: toolArgs.capabilityId as Id<"capabilities">,
              });
              if (!detail) return mcpToolResult(id, "Capability not found", true);

              const lines = [
                `# ${detail.name} [${detail.status}] (${detail.priority})`,
                `ID: ${detail._id}`,
                detail.description ? `Description: ${detail.description}` : "",
                "",
              ];

              if (detail.features.length > 0) {
                lines.push(`## Features (${detail.features.length})`);
                for (const feat of detail.features) {
                  lines.push(`- ${feat.name} [${feat.status}] (${feat.specCount} specs) (id: ${feat._id})`);
                }
              } else {
                lines.push("No features yet.");
              }

              return mcpToolResult(id, lines.join("\n"));
            }

            case "create_sprint": {
              try {
                const project = await ctx.runQuery(internal.projects.getBySlugInternal, {
                  orgId: auth.orgId,
                  slug: toolArgs.projectSlug,
                });
                if (!project) return mcpToolResult(id, "Project not found", true);

                const sprintId = await ctx.runMutation(internal.sprints.createInternal, {
                  orgId: auth.orgId,
                  userId: auth.userId,
                  projectId: project._id,
                  name: toolArgs.name,
                  startDate: new Date(toolArgs.startDate as string).getTime(),
                  endDate: new Date(toolArgs.endDate as string).getTime(),
                });
                return mcpToolResult(id, `Sprint created with ID: ${sprintId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            case "add_sprint_item": {
              try {
                const itemId = await ctx.runMutation(internal.sprints.addSprintItemInternal, {
                  orgId: auth.orgId,
                  sprintId: toolArgs.sprintId as Id<"sprints">,
                  entityType: toolArgs.entityType,
                  entityId: toolArgs.entityId,
                });
                return mcpToolResult(id, `Sprint item added with ID: ${itemId}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                return mcpToolResult(id, msg, true);
              }
            }

            default:
              return jsonResponse({
                jsonrpc: "2.0",
                error: { code: -32601, message: `Unknown tool: ${toolName}` },
                id,
              });
          }
        }

        default:
          return jsonResponse({
            jsonrpc: "2.0",
            error: { code: -32601, message: `Method not found: ${method}` },
            id,
          });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return jsonResponse({
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id,
      });
    }
  }),
});

// ─── MCP Helpers ─────────────────────────────────────────

function mcpToolResult(id: unknown, text: string, isError = false) {
  return jsonResponse({
    jsonrpc: "2.0",
    result: {
      content: [{ type: "text", text }],
      isError,
    },
    id,
  });
}

interface ProjectTreeTestCase {
  _id: string;
  status: string;
  title: string;
  type: string;
}

interface ProjectTreeUserStory {
  _id: string;
  persona: string;
  action: string;
  benefit: string;
}

interface ProjectTreeSpec {
  _id: string;
  type: string;
  title: string;
  status: string;
  testCases: ProjectTreeTestCase[];
}

interface ProjectTreeFeature {
  _id: string;
  name: string;
  status: string;
  description: string;
  acceptanceCriteria?: Array<{ id: string; text: string; sortOrder: number }>;
  specs: ProjectTreeSpec[];
  userStories: ProjectTreeUserStory[];
}

interface ProjectTreeCapability {
  _id: string;
  name: string;
  status: string;
  priority: string;
  description: string;
  features: ProjectTreeFeature[];
}

interface ProjectTree {
  _id: string;
  name: string;
  description: string;
  capabilities: ProjectTreeCapability[];
}

function formatProjectTree(tree: ProjectTree): string {
  const lines = [
    `# ${tree.name} (id: ${tree._id})`,
    tree.description ? `${tree.description}` : "",
    "",
  ];

  for (const cap of tree.capabilities) {
    lines.push(`## ${cap.name} [${cap.status}] (${cap.priority}) (id: ${cap._id})`);
    if (cap.description) lines.push(`  ${cap.description}`);

    for (const feat of cap.features) {
      lines.push(`  ### ${feat.name} [${feat.status}] (id: ${feat._id})`);
      if (feat.description) lines.push(`    ${feat.description}`);

      if (feat.acceptanceCriteria && feat.acceptanceCriteria.length > 0) {
        lines.push(`    Acceptance Criteria (${feat.acceptanceCriteria.length}):`);
        for (const ac of feat.acceptanceCriteria) {
          lines.push(`      - ${ac.text}`);
        }
      }

      if (feat.userStories.length > 0) {
        for (const story of feat.userStories) {
          lines.push(`    - [Story] As a ${story.persona}, I want to ${story.action} so that ${story.benefit} (id: ${story._id})`);
        }
      }

      for (const spec of feat.specs) {
        const testInfo =
          spec.testCases.length > 0
            ? ` (${spec.testCases.length} tests)`
            : " (no tests)";
        lines.push(`    - [${spec.type}] ${spec.title} [${spec.status}]${testInfo} (id: ${spec._id})`);
        for (const tc of spec.testCases) {
          lines.push(`      - [${tc.type}] ${tc.title} [${tc.status}] (id: ${tc._id})`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function detectGaps(tree: ProjectTree) {
  const gaps: Array<{ type: string; path: string; message: string }> = [];

  for (const cap of tree.capabilities) {
    if (cap.features.length === 0) {
      gaps.push({
        type: "no_features",
        path: `${tree.name} > ${cap.name}`,
        message: `Capability "${cap.name}" has no features`,
      });
    }
    for (const feat of cap.features) {
      if (feat.specs.length === 0) {
        gaps.push({
          type: "no_specs",
          path: `${tree.name} > ${cap.name} > ${feat.name}`,
          message: `Feature "${feat.name}" has no specs`,
        });
      }
      for (const spec of feat.specs) {
        if (spec.testCases.length === 0) {
          gaps.push({
            type: "no_tests",
            path: `${tree.name} > ${cap.name} > ${feat.name} > ${spec.title}`,
            message: `Spec "${spec.title}" has no test cases`,
          });
        }
      }
      if (feat.userStories.length === 0) {
        gaps.push({
          type: "no_stories",
          path: `${tree.name} > ${cap.name} > ${feat.name}`,
          message: `Feature "${feat.name}" has no user stories`,
        });
      }
    }
  }
  return gaps;
}

function computeCoverage(tree: ProjectTree) {
  let totalSpecs = 0;
  let specsWithTests = 0;
  let totalTests = 0;
  let passingTests = 0;

  for (const cap of tree.capabilities) {
    for (const feat of cap.features) {
      for (const spec of feat.specs) {
        totalSpecs++;
        if (spec.testCases.length > 0) specsWithTests++;
        totalTests += spec.testCases.length;
        passingTests += spec.testCases.filter(
          (t: { status: string }) => t.status === "passing",
        ).length;
      }
    }
  }

  return {
    totalSpecs,
    specsWithTests,
    testCoverage: totalSpecs > 0 ? Math.round((specsWithTests / totalSpecs) * 100) : 0,
    totalTests,
    passingTests,
    passRate: totalTests > 0 ? Math.round((passingTests / totalTests) * 100) : 0,
  };
}

export default http;
