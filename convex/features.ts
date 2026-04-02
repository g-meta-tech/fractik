import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUser } from "./lib/auth";
import { cascadeDeleteFeature } from "./projects";

export const create = mutation({
  args: {
    capabilityId: v.id("capabilities"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const cap = await ctx.db.get(args.capabilityId);
    if (!cap || cap.orgId !== orgId) {
      throw new Error("Not found");
    }

    const existing = await ctx.db
      .query("features")
      .withIndex("by_capability", (q) => q.eq("capabilityId", args.capabilityId))
      .collect();

    const now = Date.now();
    return await ctx.db.insert("features", {
      orgId,
      capabilityId: args.capabilityId,
      name: args.name,
      description: args.description ?? "",
      acceptanceCriteria: [],
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
    featureId: v.id("features"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("defined"),
        v.literal("spec_ready"),
        v.literal("in_progress"),
        v.literal("done"),
      ),
    ),
    acceptanceCriteria: v.optional(
      v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          sortOrder: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const feature = await ctx.db.get(args.featureId);
    if (!feature || feature.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Validate status transitions
    if (args.status !== undefined) {
      const validTransitions: Record<string, string[]> = {
        draft: ["defined"],
        defined: ["spec_ready"],
        spec_ready: ["in_progress"],
        in_progress: ["done"],
      };
      const allowed = validTransitions[feature.status];
      if (!allowed || !allowed.includes(args.status)) {
        throw new Error(
          `Invalid status transition: ${feature.status} -> ${args.status}`,
        );
      }
    }

    const { featureId, ...updates } = args;
    await ctx.db.patch(featureId, {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.acceptanceCriteria !== undefined && {
        acceptanceCriteria: updates.acceptanceCriteria,
      }),
      updatedAt: Date.now(),
    });
  },
});

export const move = mutation({
  args: {
    featureId: v.id("features"),
    targetCapabilityId: v.id("capabilities"),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const feature = await ctx.db.get(args.featureId);
    if (!feature || feature.orgId !== orgId) {
      throw new Error("Not found");
    }
    const targetCap = await ctx.db.get(args.targetCapabilityId);
    if (!targetCap || targetCap.orgId !== orgId) {
      throw new Error("Not found");
    }

    const existingInTarget = await ctx.db
      .query("features")
      .withIndex("by_capability", (q) =>
        q.eq("capabilityId", args.targetCapabilityId),
      )
      .collect();

    await ctx.db.patch(args.featureId, {
      capabilityId: args.targetCapabilityId,
      sortOrder: existingInTarget.length,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { featureId: v.id("features") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const feature = await ctx.db.get(args.featureId);
    if (!feature || feature.orgId !== orgId) {
      throw new Error("Not found");
    }

    await cascadeDeleteFeature(ctx, args.featureId);
  },
});

// ─── Internal mutations for HTTP Actions ────────────────

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    capabilityId: v.id("capabilities"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cap = await ctx.db.get(args.capabilityId);
    if (!cap || cap.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    const existing = await ctx.db
      .query("features")
      .withIndex("by_capability", (q) => q.eq("capabilityId", args.capabilityId))
      .collect();

    const now = Date.now();
    return await ctx.db.insert("features", {
      orgId: args.orgId,
      capabilityId: args.capabilityId,
      name: args.name,
      description: args.description ?? "",
      acceptanceCriteria: [],
      status: "draft",
      sortOrder: existing.length,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listByCapability = query({
  args: { capabilityId: v.id("capabilities") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const cap = await ctx.db.get(args.capabilityId);
    if (!cap || cap.orgId !== orgId) {
      throw new Error("Not found");
    }

    const features = await ctx.db
      .query("features")
      .withIndex("by_capability", (q) => q.eq("capabilityId", args.capabilityId))
      .collect();

    return features.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});
