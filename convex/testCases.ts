import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const create = mutation({
  args: {
    specId: v.id("specs"),
    type: v.union(
      v.literal("unit"),
      v.literal("integration"),
      v.literal("e2e"),
      v.literal("manual"),
    ),
    title: v.string(),
    preconditions: v.optional(v.string()),
    steps: v.optional(
      v.array(
        v.object({
          id: v.string(),
          action: v.string(),
          expectedResult: v.string(),
          sortOrder: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();
    return await ctx.db.insert("testCases", {
      orgId,
      specId: args.specId,
      type: args.type,
      title: args.title,
      preconditions: args.preconditions ?? "",
      steps: args.steps ?? [],
      status: "defined",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    testCaseId: v.id("testCases"),
    title: v.optional(v.string()),
    preconditions: v.optional(v.string()),
    steps: v.optional(
      v.array(
        v.object({
          id: v.string(),
          action: v.string(),
          expectedResult: v.string(),
          sortOrder: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const test = await ctx.db.get(args.testCaseId);
    if (!test || test.orgId !== orgId) {
      throw new Error("Not found");
    }

    const { testCaseId, ...updates } = args;
    await ctx.db.patch(testCaseId, {
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.preconditions !== undefined && {
        preconditions: updates.preconditions,
      }),
      ...(updates.steps !== undefined && { steps: updates.steps }),
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    testCaseId: v.id("testCases"),
    status: v.union(
      v.literal("defined"),
      v.literal("passing"),
      v.literal("failing"),
      v.literal("skipped"),
      v.literal("blocked"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const test = await ctx.db.get(args.testCaseId);
    if (!test || test.orgId !== orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();

    // Log status change
    await ctx.db.insert("testStatusLog", {
      orgId,
      testCaseId: args.testCaseId,
      previousStatus: test.status,
      newStatus: args.status,
      note: args.note,
      changedBy: userId,
      changedAt: now,
    });

    await ctx.db.patch(args.testCaseId, {
      status: args.status,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { testCaseId: v.id("testCases") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const test = await ctx.db.get(args.testCaseId);
    if (!test || test.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Delete status logs
    const logs = await ctx.db
      .query("testStatusLog")
      .withIndex("by_test_case", (q) => q.eq("testCaseId", args.testCaseId))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(args.testCaseId);
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
      .query("testCases")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
      .collect();
  },
});

// ─── Internal for HTTP Actions ───────────────────────────

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    specId: v.id("specs"),
    type: v.union(
      v.literal("unit"),
      v.literal("integration"),
      v.literal("e2e"),
      v.literal("manual"),
    ),
    title: v.string(),
    preconditions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();
    return await ctx.db.insert("testCases", {
      orgId: args.orgId,
      specId: args.specId,
      type: args.type,
      title: args.title,
      preconditions: args.preconditions ?? "",
      steps: [],
      status: "defined",
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listBySpecInternal = internalQuery({
  args: { orgId: v.string(), specId: v.id("specs") },
  handler: async (ctx, args) => {
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== args.orgId) return [];

    return await ctx.db
      .query("testCases")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
      .collect();
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    testCaseId: v.id("testCases"),
    status: v.union(
      v.literal("defined"),
      v.literal("passing"),
      v.literal("failing"),
      v.literal("skipped"),
      v.literal("blocked"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testCaseId);
    if (!test || test.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();

    await ctx.db.insert("testStatusLog", {
      orgId: args.orgId,
      testCaseId: args.testCaseId,
      previousStatus: test.status,
      newStatus: args.status,
      note: args.note,
      changedBy: args.userId,
      changedAt: now,
    });

    await ctx.db.patch(args.testCaseId, {
      status: args.status,
      updatedAt: now,
    });
  },
});
