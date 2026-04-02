import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const create = mutation({
  args: {
    specId: v.id("specs"),
    sprintId: v.optional(v.id("sprints")),
    type: v.union(
      v.literal("deviation"),
      v.literal("enhancement"),
      v.literal("issue"),
    ),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    if (args.sprintId) {
      const sprint = await ctx.db.get(args.sprintId);
      if (!sprint || sprint.orgId !== orgId) {
        throw new Error("Not found");
      }
    }

    return await ctx.db.insert("divergences", {
      orgId,
      specId: args.specId,
      sprintId: args.sprintId,
      type: args.type,
      description: args.description,
      reportedBy: userId,
      decision: "pending",
      createdAt: Date.now(),
    });
  },
});

export const decide = mutation({
  args: {
    divergenceId: v.id("divergences"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    decisionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const div = await ctx.db.get(args.divergenceId);
    if (!div || div.orgId !== orgId) {
      throw new Error("Not found");
    }

    await ctx.db.patch(args.divergenceId, {
      decision: args.decision,
      decisionNote: args.decisionNote,
      decidedBy: userId,
      decidedAt: Date.now(),
    });
  },
});

export const listBySpec = query({
  args: { specId: v.id("specs") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    return await ctx.db
      .query("divergences")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
      .collect();
  },
});

export const listPendingByOrg = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await getAuthUser(ctx);
    return await ctx.db
      .query("divergences")
      .withIndex("by_org_and_decision", (q) =>
        q.eq("orgId", orgId).eq("decision", "pending"),
      )
      .collect();
  },
});

// ─── Internal for HTTP Actions ───────────────────────────

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    specId: v.id("specs"),
    sprintId: v.optional(v.id("sprints")),
    type: v.union(
      v.literal("deviation"),
      v.literal("enhancement"),
      v.literal("issue"),
    ),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    return await ctx.db.insert("divergences", {
      orgId: args.orgId,
      specId: args.specId,
      sprintId: args.sprintId,
      type: args.type,
      description: args.description,
      reportedBy: args.userId,
      decision: "pending",
      createdAt: Date.now(),
    });
  },
});
