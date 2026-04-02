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

async function validateApiKeyAsync(
  ctx: ActionCtx,
  request: Request,
): Promise<{ orgId: string; userId: string; keyId: Id<"apiKeys"> } | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const key = header.slice(7);

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

// ─── REST API: Read endpoints (BE-026) ───────────────────

http.route({
  path: "/api/projects",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await validateApiKeyAsync(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);

    const projects = await ctx.runQuery(internal.projects.listByOrg, {
      orgId: auth.orgId,
    });

    return jsonResponse({ data: projects, meta: { timestamp: Date.now() } });
  }),
});

http.route({
  path: "/api/specs/design-system",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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
    const auth = await validateApiKeyAsync(ctx, request);
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

// ─── MCP Server (BE-028) ────────────────────────────────

http.route({
  path: "/mcp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await validateApiKeyAsync(ctx, request);
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
  status: string;
}

interface ProjectTreeSpec {
  type: string;
  title: string;
  status: string;
  testCases: ProjectTreeTestCase[];
}

interface ProjectTreeFeature {
  name: string;
  status: string;
  description: string;
  specs: ProjectTreeSpec[];
  userStories: unknown[];
}

interface ProjectTreeCapability {
  name: string;
  status: string;
  priority: string;
  description: string;
  features: ProjectTreeFeature[];
}

interface ProjectTree {
  name: string;
  description: string;
  capabilities: ProjectTreeCapability[];
}

function formatProjectTree(tree: ProjectTree): string {
  const lines = [
    `# ${tree.name}`,
    tree.description ? `${tree.description}` : "",
    "",
  ];

  for (const cap of tree.capabilities) {
    lines.push(`## ${cap.name} [${cap.status}] (${cap.priority})`);
    if (cap.description) lines.push(`  ${cap.description}`);

    for (const feat of cap.features) {
      lines.push(`  ### ${feat.name} [${feat.status}]`);
      if (feat.description) lines.push(`    ${feat.description}`);

      for (const spec of feat.specs) {
        const testInfo =
          spec.testCases.length > 0
            ? ` (${spec.testCases.length} tests)`
            : " (no tests)";
        lines.push(`    - [${spec.type}] ${spec.title} [${spec.status}]${testInfo}`);
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
