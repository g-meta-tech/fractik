import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const create = mutation({
  args: {
    featureId: v.id("features"),
    type: v.union(v.literal("NF"), v.literal("BE"), v.literal("FE"), v.literal("DA")),
    title: v.string(),
    content: v.optional(v.string()),
    isDesignSystem: v.optional(v.boolean()),
    isDataModel: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const feature = await ctx.db.get(args.featureId);
    if (!feature || feature.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Get project for uniqueness checks
    const cap = await ctx.db.get(feature.capabilityId);
    if (!cap) throw new Error("Not found");

    if (args.isDesignSystem) {
      // Check no other isDesignSystem spec in this project
      const allCaps = await ctx.db
        .query("capabilities")
        .withIndex("by_project", (q) => q.eq("projectId", cap.projectId))
        .collect();
      for (const c of allCaps) {
        const feats = await ctx.db
          .query("features")
          .withIndex("by_capability", (q) => q.eq("capabilityId", c._id))
          .collect();
        for (const f of feats) {
          const specs = await ctx.db
            .query("specs")
            .withIndex("by_feature", (q) => q.eq("featureId", f._id))
            .collect();
          if (specs.some((s) => s.isDesignSystem)) {
            throw new Error("Only one Design System spec per project");
          }
        }
      }
    }

    if (args.isDataModel) {
      const allCaps = await ctx.db
        .query("capabilities")
        .withIndex("by_project", (q) => q.eq("projectId", cap.projectId))
        .collect();
      for (const c of allCaps) {
        const feats = await ctx.db
          .query("features")
          .withIndex("by_capability", (q) => q.eq("capabilityId", c._id))
          .collect();
        for (const f of feats) {
          const specs = await ctx.db
            .query("specs")
            .withIndex("by_feature", (q) => q.eq("featureId", f._id))
            .collect();
          if (specs.some((s) => s.isDataModel)) {
            throw new Error("Only one Data Model spec per project");
          }
        }
      }
    }

    const now = Date.now();
    return await ctx.db.insert("specs", {
      orgId,
      featureId: args.featureId,
      type: args.type,
      title: args.title,
      content: args.content ?? "",
      status: "draft",
      versionNumber: 1,
      isDesignSystem: args.isDesignSystem,
      isDataModel: args.isDataModel,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateContent = mutation({
  args: {
    specId: v.id("specs"),
    content: v.string(),
    changeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();

    // Save previous version
    await ctx.db.insert("specVersions", {
      orgId,
      specId: args.specId,
      content: spec.content,
      versionNumber: spec.versionNumber,
      changeNote: args.changeNote ?? "",
      changedBy: userId,
      changedAt: now,
    });

    await ctx.db.patch(args.specId, {
      content: args.content,
      versionNumber: spec.versionNumber + 1,
      updatedAt: now,
    });
  },
});

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["reviewed"],
  reviewed: ["approved"],
  approved: ["implemented", "deprecated"],
  implemented: ["deprecated"],
};

export const updateStatus = mutation({
  args: {
    specId: v.id("specs"),
    status: v.union(
      v.literal("draft"),
      v.literal("reviewed"),
      v.literal("approved"),
      v.literal("implemented"),
      v.literal("deprecated"),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Any status can go to deprecated
    if (args.status !== "deprecated") {
      const allowed = VALID_STATUS_TRANSITIONS[spec.status];
      if (!allowed || !allowed.includes(args.status)) {
        throw new Error(
          `Invalid status transition: ${spec.status} -> ${args.status}`,
        );
      }
    }

    await ctx.db.patch(args.specId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { specId: v.id("specs") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Cascade: specVersions
    const versions = await ctx.db
      .query("specVersions")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
      .collect();
    for (const ver of versions) {
      await ctx.db.delete(ver._id);
    }

    // Cascade: testCases > testStatusLog
    const tests = await ctx.db
      .query("testCases")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
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

    // Cascade: divergences
    const divergences = await ctx.db
      .query("divergences")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
      .collect();
    for (const div of divergences) {
      await ctx.db.delete(div._id);
    }

    await ctx.db.delete(args.specId);
  },
});

export const get = query({
  args: { specId: v.id("specs") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }
    return spec;
  },
});

export const listByFeature = query({
  args: { featureId: v.id("features") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const feature = await ctx.db.get(args.featureId);
    if (!feature || feature.orgId !== orgId) {
      throw new Error("Not found");
    }

    return await ctx.db
      .query("specs")
      .withIndex("by_feature", (q) => q.eq("featureId", args.featureId))
      .collect();
  },
});

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(
      v.union(v.literal("NF"), v.literal("BE"), v.literal("FE"), v.literal("DA")),
    ),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("reviewed"),
        v.literal("approved"),
        v.literal("implemented"),
        v.literal("deprecated"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    const capabilities = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const results = [];
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
          if (args.type && spec.type !== args.type) continue;
          if (args.status && spec.status !== args.status) continue;

          const tests = await ctx.db
            .query("testCases")
            .withIndex("by_spec", (q) => q.eq("specId", spec._id))
            .collect();

          const divergences = await ctx.db
            .query("divergences")
            .withIndex("by_spec", (q) => q.eq("specId", spec._id))
            .take(1);

          results.push({
            ...spec,
            featureName: feat.name,
            capabilityName: cap.name,
            testCount: tests.length,
            hasDivergences: divergences.length > 0,
          });
        }
      }
    }

    return results;
  },
});

// ─── Internal queries for HTTP Actions ───────────────────

export const getInternal = internalQuery({
  args: { orgId: v.string(), specId: v.id("specs") },
  handler: async (ctx, args) => {
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== args.orgId) return null;
    return spec;
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    orgId: v.string(),
    specId: v.id("specs"),
    status: v.union(
      v.literal("draft"),
      v.literal("reviewed"),
      v.literal("approved"),
      v.literal("implemented"),
      v.literal("deprecated"),
    ),
  },
  handler: async (ctx, args) => {
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    if (args.status !== "deprecated") {
      const allowed = VALID_STATUS_TRANSITIONS[spec.status];
      if (!allowed || !allowed.includes(args.status)) {
        throw new Error(
          `Invalid status transition: ${spec.status} -> ${args.status}`,
        );
      }
    }

    await ctx.db.patch(args.specId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const getDesignSystem = internalQuery({
  args: { orgId: v.string(), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) return null;

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
        const specs = await ctx.db
          .query("specs")
          .withIndex("by_feature", (q) => q.eq("featureId", feat._id))
          .collect();
        const ds = specs.find((s) => s.isDesignSystem);
        if (ds) return ds;
      }
    }
    return null;
  },
});

export const getDataModel = internalQuery({
  args: { orgId: v.string(), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) return null;

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
        const specs = await ctx.db
          .query("specs")
          .withIndex("by_feature", (q) => q.eq("featureId", feat._id))
          .collect();
        const dm = specs.find((s) => s.isDataModel);
        if (dm) return dm;
      }
    }
    return null;
  },
});
