import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, MutationCtx } from "./_generated/server";
import { getAuthUser } from "./lib/auth";
import { Id } from "./_generated/dataModel";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);

    if (args.name.length < 1 || args.name.length > 100) {
      throw new Error("Name must be between 1 and 100 characters");
    }

    let baseSlug = toSlug(args.name);
    if (baseSlug.length < 2) {
      baseSlug = "project";
    }

    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_org_and_slug", (q) => q.eq("orgId", orgId).eq("slug", slug))
        .unique();
      if (!existing) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const now = Date.now();
    return await ctx.db.insert("projects", {
      orgId,
      slug,
      name: args.name,
      description: args.description ?? "",
      visionContent: "",
      visionVersionNumber: 1,
      isPublic: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    if (args.name !== undefined && (args.name.length < 1 || args.name.length > 100)) {
      throw new Error("Name must be between 1 and 100 characters");
    }

    if (args.slug !== undefined) {
      if (args.slug.length < 2 || args.slug.length > 50) {
        throw new Error("Slug must be between 2 and 50 characters");
      }
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_org_and_slug", (q) => q.eq("orgId", orgId).eq("slug", args.slug!))
        .unique();
      if (existing && existing._id !== args.projectId) {
        throw new Error("Slug already in use");
      }
    }

    await ctx.db.patch(args.projectId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.slug !== undefined && { slug: args.slug }),
      ...(args.githubRepoUrl !== undefined && { githubRepoUrl: args.githubRepoUrl }),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Cascade: capabilities > features > userStories, specs > specVersions, testCases > testStatusLog, divergences
    const capabilities = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const cap of capabilities) {
      const features = await ctx.db
        .query("features")
        .withIndex("by_capability", (q) => q.eq("capabilityId", cap._id))
        .collect();

      for (const feat of features) {
        await cascadeDeleteFeature(ctx, feat._id);
      }
      await ctx.db.delete(cap._id);
    }

    // Cascade: visionVersions
    const visionVersions = await ctx.db
      .query("visionVersions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const vv of visionVersions) {
      await ctx.db.delete(vv._id);
    }

    // Cascade: sprints > sprintItems, logEntries, defects
    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const sprint of sprints) {
      await cascadeDeleteSprint(ctx, sprint._id);
    }

    // Cascade: githubConnections
    const connections = await ctx.db
      .query("githubConnections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const conn of connections) {
      await ctx.db.delete(conn._id);
    }

    await ctx.db.delete(args.projectId);
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }
    return project;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    return await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) => q.eq("orgId", orgId).eq("slug", args.slug))
      .unique();
  },
});

export const listWithMetrics = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await getAuthUser(ctx);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const results = [];
    for (const project of projects) {
      const capabilities = await ctx.db
        .query("capabilities")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      let featureCount = 0;
      let specCount = 0;
      let testCount = 0;
      let specsWithTests = 0;

      for (const cap of capabilities) {
        const features = await ctx.db
          .query("features")
          .withIndex("by_capability", (q) => q.eq("capabilityId", cap._id))
          .collect();
        featureCount += features.length;

        for (const feat of features) {
          const specs = await ctx.db
            .query("specs")
            .withIndex("by_feature", (q) => q.eq("featureId", feat._id))
            .collect();
          specCount += specs.length;

          for (const spec of specs) {
            const tests = await ctx.db
              .query("testCases")
              .withIndex("by_spec", (q) => q.eq("specId", spec._id))
              .take(1);
            if (tests.length > 0) {
              specsWithTests++;
            }
            const testList = await ctx.db
              .query("testCases")
              .withIndex("by_spec", (q) => q.eq("specId", spec._id))
              .collect();
            testCount += testList.length;
          }
        }
      }

      const pendingDivergences = await ctx.db
        .query("divergences")
        .withIndex("by_org_and_decision", (q) =>
          q.eq("orgId", orgId).eq("decision", "pending"),
        )
        .collect();
      // Filter to this project's specs
      const projectSpecIds = new Set<string>();
      for (const cap of capabilities) {
        const features = await ctx.db
          .query("features")
          .withIndex("by_capability", (q) => q.eq("capabilityId", cap._id))
          .collect();
        for (const feat of features) {
          const specs = await ctx.db
            .query("specs")
            .withIndex("by_feature", (q) => q.eq("featureId", feat._id))
            .collect();
          for (const spec of specs) {
            projectSpecIds.add(spec._id);
          }
        }
      }
      const projectDivergences = pendingDivergences.filter((d) =>
        projectSpecIds.has(d.specId),
      );

      const coverage = specCount > 0 ? Math.round((specsWithTests / specCount) * 100) : 0;

      results.push({
        ...project,
        metrics: {
          capabilityCount: capabilities.length,
          featureCount,
          specCount,
          testCount,
          coverage,
          pendingDivergences: projectDivergences.length,
        },
      });
    }

    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// ─── Vision versioning (BE-005) ──────────────────────────

export const updateVision = mutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
    changeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();

    // Save previous version
    await ctx.db.insert("visionVersions", {
      orgId,
      projectId: args.projectId,
      content: project.visionContent,
      versionNumber: project.visionVersionNumber,
      changeNote: args.changeNote ?? "",
      changedBy: userId,
      changedAt: now,
    });

    await ctx.db.patch(args.projectId, {
      visionContent: args.content,
      visionVersionNumber: project.visionVersionNumber + 1,
      updatedAt: now,
    });
  },
});

export const listVisionVersions = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    const versions = await ctx.db
      .query("visionVersions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return versions.map((v) => ({
      _id: v._id,
      versionNumber: v.versionNumber,
      changeNote: v.changeNote,
      changedBy: v.changedBy,
      changedAt: v.changedAt,
    }));
  },
});

export const getVisionVersion = query({
  args: { versionId: v.id("visionVersions") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const version = await ctx.db.get(args.versionId);
    if (!version || version.orgId !== orgId) {
      throw new Error("Not found");
    }
    return version;
  },
});

export const listByOrg = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await getAuthUser(ctx);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// ─── Internal queries for HTTP Actions ───────────────────

export const listByOrgInternal = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const getBySlugInternal = internalQuery({
  args: { orgId: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();
  },
});

export const getProjectTree = internalQuery({
  args: { orgId: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.slug),
      )
      .unique();

    if (!project) return null;

    const capabilities = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    const tree = [];
    for (const cap of capabilities) {
      const features = await ctx.db
        .query("features")
        .withIndex("by_capability", (q) => q.eq("capabilityId", cap._id))
        .collect();

      const featureNodes = [];
      for (const feat of features) {
        const specs = await ctx.db
          .query("specs")
          .withIndex("by_feature", (q) => q.eq("featureId", feat._id))
          .collect();

        const specNodes = [];
        for (const spec of specs) {
          const tests = await ctx.db
            .query("testCases")
            .withIndex("by_spec", (q) => q.eq("specId", spec._id))
            .collect();

          specNodes.push({
            ...spec,
            testCases: tests,
          });
        }

        const stories = await ctx.db
          .query("userStories")
          .withIndex("by_feature", (q) => q.eq("featureId", feat._id))
          .collect();

        featureNodes.push({
          ...feat,
          specs: specNodes,
          userStories: stories,
        });
      }

      tree.push({
        ...cap,
        features: featureNodes,
      });
    }

    return { ...project, capabilities: tree };
  },
});

// ─── Internal mutations for HTTP Actions ────────────────

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.name.length < 1 || args.name.length > 100) {
      throw new Error("Name must be between 1 and 100 characters");
    }

    let baseSlug = toSlug(args.name);
    if (baseSlug.length < 2) {
      baseSlug = "project";
    }

    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_org_and_slug", (q) => q.eq("orgId", args.orgId).eq("slug", slug))
        .unique();
      if (!existing) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const now = Date.now();
    return await ctx.db.insert("projects", {
      orgId: args.orgId,
      slug,
      name: args.name,
      description: args.description ?? "",
      visionContent: "",
      visionVersionNumber: 1,
      isPublic: false,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateInternal = internalMutation({
  args: {
    orgId: v.string(),
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    if (args.name !== undefined && (args.name.length < 1 || args.name.length > 100)) {
      throw new Error("Name must be between 1 and 100 characters");
    }

    await ctx.db.patch(args.projectId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.githubRepoUrl !== undefined && { githubRepoUrl: args.githubRepoUrl }),
      updatedAt: Date.now(),
    });
  },
});

export const updateVisionInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    projectId: v.id("projects"),
    content: v.string(),
    changeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();

    await ctx.db.insert("visionVersions", {
      orgId: args.orgId,
      projectId: args.projectId,
      content: project.visionContent,
      versionNumber: project.visionVersionNumber,
      changeNote: args.changeNote ?? "",
      changedBy: args.userId,
      changedAt: now,
    });

    await ctx.db.patch(args.projectId, {
      visionContent: args.content,
      visionVersionNumber: project.visionVersionNumber + 1,
      updatedAt: now,
    });
  },
});

// ─── Cascade helpers ─────────────────────────────────────

export async function cascadeDeleteFeature(
  ctx: MutationCtx,
  featureId: Id<"features">,
) {
  // Delete user stories
  const stories = await ctx.db
    .query("userStories")
    .withIndex("by_feature", (q) => q.eq("featureId", featureId))
    .collect();
  for (const story of stories) {
    await ctx.db.delete(story._id);
  }

  // Delete specs and their children
  const specs = await ctx.db
    .query("specs")
    .withIndex("by_feature", (q) => q.eq("featureId", featureId))
    .collect();
  for (const spec of specs) {
    await cascadeDeleteSpec(ctx, spec._id);
  }

  await ctx.db.delete(featureId);
}

export async function cascadeDeleteSpec(
  ctx: MutationCtx,
  specId: Id<"specs">,
) {
  // Delete spec versions
  const versions = await ctx.db
    .query("specVersions")
    .withIndex("by_spec", (q) => q.eq("specId", specId))
    .collect();
  for (const ver of versions) {
    await ctx.db.delete(ver._id);
  }

  // Delete test cases and their status logs
  const tests = await ctx.db
    .query("testCases")
    .withIndex("by_spec", (q) => q.eq("specId", specId))
    .collect();
  for (const test of tests) {
    const logs = await ctx.db
      .query("testStatusLog")
      .withIndex("by_test_case", (q) => q.eq("testCaseId", test._id))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    await ctx.db.delete(test._id);
  }

  // Delete divergences
  const divergences = await ctx.db
    .query("divergences")
    .withIndex("by_spec", (q) => q.eq("specId", specId))
    .collect();
  for (const div of divergences) {
    await ctx.db.delete(div._id);
  }

  await ctx.db.delete(specId);
}

export async function cascadeDeleteSprint(
  ctx: MutationCtx,
  sprintId: Id<"sprints">,
) {
  const items = await ctx.db
    .query("sprintItems")
    .withIndex("by_sprint", (q) => q.eq("sprintId", sprintId))
    .collect();
  for (const item of items) {
    await ctx.db.delete(item._id);
  }

  const logs = await ctx.db
    .query("logEntries")
    .withIndex("by_sprint", (q) => q.eq("sprintId", sprintId))
    .collect();
  for (const log of logs) {
    await ctx.db.delete(log._id);
  }

  const defects = await ctx.db
    .query("defects")
    .withIndex("by_sprint", (q) => q.eq("sprintId", sprintId))
    .collect();
  for (const defect of defects) {
    await ctx.db.delete(defect._id);
  }

  await ctx.db.delete(sprintId);
}
