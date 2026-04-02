import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
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
