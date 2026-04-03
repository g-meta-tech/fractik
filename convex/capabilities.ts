import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUser } from "./lib/auth";
import { cascadeDeleteFeature } from "./projects";

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    const existing = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const now = Date.now();
    return await ctx.db.insert("capabilities", {
      orgId,
      projectId: args.projectId,
      name: args.name,
      description: args.description ?? "",
      priority: "medium",
      status: "draft",
      sortOrder: existing.length,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    capabilityId: v.id("capabilities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("defined"),
        v.literal("in_progress"),
        v.literal("done"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const cap = await ctx.db.get(args.capabilityId);
    if (!cap || cap.orgId !== orgId) {
      throw new Error("Not found");
    }

    const { capabilityId, ...updates } = args;
    await ctx.db.patch(capabilityId, {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.status !== undefined && { status: updates.status }),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { capabilityId: v.id("capabilities") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const cap = await ctx.db.get(args.capabilityId);
    if (!cap || cap.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Cascade delete features
    const features = await ctx.db
      .query("features")
      .withIndex("by_capability", (q) => q.eq("capabilityId", args.capabilityId))
      .collect();
    for (const feat of features) {
      await cascadeDeleteFeature(ctx, feat._id);
    }

    await ctx.db.delete(args.capabilityId);

    // Reorder siblings
    const siblings = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", cap.projectId))
      .collect();
    const sorted = siblings.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const [i, sibling] of sorted.entries()) {
      if (sibling.sortOrder !== i) {
        await ctx.db.patch(sibling._id, { sortOrder: i });
      }
    }
  },
});

export const reorder = mutation({
  args: {
    projectId: v.id("projects"),
    orderedIds: v.array(v.id("capabilities")),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Validate all IDs belong to this project and org
    const existing = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const existingIds = new Set(existing.map((c) => c._id as string));

    for (const [i, capId] of args.orderedIds.entries()) {
      if (!existingIds.has(capId)) {
        throw new Error("Not found");
      }
      await ctx.db.patch(capId, { sortOrder: i });
    }
  },
});

// ─── Internal mutations for HTTP Actions ────────────────

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    const existing = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const now = Date.now();
    return await ctx.db.insert("capabilities", {
      orgId: args.orgId,
      projectId: args.projectId,
      name: args.name,
      description: args.description ?? "",
      priority: "medium",
      status: "draft",
      sortOrder: existing.length,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateInternal = internalMutation({
  args: {
    orgId: v.string(),
    capabilityId: v.id("capabilities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("defined"),
        v.literal("in_progress"),
        v.literal("done"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const cap = await ctx.db.get(args.capabilityId);
    if (!cap || cap.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    await ctx.db.patch(args.capabilityId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.priority !== undefined && { priority: args.priority }),
      ...(args.status !== undefined && { status: args.status }),
      updatedAt: Date.now(),
    });
  },
});

export const getDetailedInternal = internalQuery({
  args: {
    orgId: v.string(),
    capabilityId: v.id("capabilities"),
  },
  handler: async (ctx, args) => {
    const cap = await ctx.db.get(args.capabilityId);
    if (!cap || cap.orgId !== args.orgId) return null;

    const features = await ctx.db
      .query("features")
      .withIndex("by_capability", (q) => q.eq("capabilityId", args.capabilityId))
      .collect();

    const featuresWithCounts = await Promise.all(
      features.map(async (feat) => {
        const specs = await ctx.db
          .query("specs")
          .withIndex("by_feature", (q) => q.eq("featureId", feat._id))
          .collect();
        return {
          _id: feat._id,
          name: feat.name,
          status: feat.status,
          description: feat.description,
          specCount: specs.length,
        };
      }),
    );

    return {
      ...cap,
      features: featuresWithCounts.sort((a, b) => {
        const fa = features.find((f) => f._id === a._id);
        const fb = features.find((f) => f._id === b._id);
        return (fa?.sortOrder ?? 0) - (fb?.sortOrder ?? 0);
      }),
    };
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    const caps = await ctx.db
      .query("capabilities")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return caps.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});
