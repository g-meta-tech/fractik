import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const create = mutation({
  args: {
    featureId: v.id("features"),
    persona: v.string(),
    action: v.string(),
    benefit: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const feature = await ctx.db.get(args.featureId);
    if (!feature || feature.orgId !== orgId) {
      throw new Error("Not found");
    }

    if (!args.persona.trim() || !args.action.trim() || !args.benefit.trim()) {
      throw new Error("Persona, action, and benefit must not be empty");
    }

    const existing = await ctx.db
      .query("userStories")
      .withIndex("by_feature", (q) => q.eq("featureId", args.featureId))
      .collect();

    const now = Date.now();
    return await ctx.db.insert("userStories", {
      orgId,
      featureId: args.featureId,
      persona: args.persona,
      action: args.action,
      benefit: args.benefit,
      criteria: [],
      sortOrder: existing.length,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    storyId: v.id("userStories"),
    persona: v.optional(v.string()),
    action: v.optional(v.string()),
    benefit: v.optional(v.string()),
    criteria: v.optional(
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
    const story = await ctx.db.get(args.storyId);
    if (!story || story.orgId !== orgId) {
      throw new Error("Not found");
    }

    const { storyId, ...updates } = args;
    await ctx.db.patch(storyId, {
      ...(updates.persona !== undefined && { persona: updates.persona }),
      ...(updates.action !== undefined && { action: updates.action }),
      ...(updates.benefit !== undefined && { benefit: updates.benefit }),
      ...(updates.criteria !== undefined && { criteria: updates.criteria }),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { storyId: v.id("userStories") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.orgId !== orgId) {
      throw new Error("Not found");
    }
    await ctx.db.delete(args.storyId);
  },
});

// ─── Internal mutations for HTTP Actions ────────────────

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    featureId: v.id("features"),
    persona: v.string(),
    action: v.string(),
    benefit: v.string(),
  },
  handler: async (ctx, args) => {
    const feature = await ctx.db.get(args.featureId);
    if (!feature || feature.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    if (!args.persona.trim() || !args.action.trim() || !args.benefit.trim()) {
      throw new Error("Persona, action, and benefit must not be empty");
    }

    const existing = await ctx.db
      .query("userStories")
      .withIndex("by_feature", (q) => q.eq("featureId", args.featureId))
      .collect();

    const now = Date.now();
    return await ctx.db.insert("userStories", {
      orgId: args.orgId,
      featureId: args.featureId,
      persona: args.persona,
      action: args.action,
      benefit: args.benefit,
      criteria: [],
      sortOrder: existing.length,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
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

    const stories = await ctx.db
      .query("userStories")
      .withIndex("by_feature", (q) => q.eq("featureId", args.featureId))
      .collect();

    return stories.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});
