import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();
    return await ctx.db.insert("sprints", {
      orgId,
      projectId: args.projectId,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "planning",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    sprintId: v.id("sprints"),
    name: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== orgId) {
      throw new Error("Not found");
    }

    const { sprintId, ...updates } = args;
    await ctx.db.patch(sprintId, {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate }),
      ...(updates.endDate !== undefined && { endDate: updates.endDate }),
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    sprintId: v.id("sprints"),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== orgId) {
      throw new Error("Not found");
    }

    // Only one active sprint per project
    if (args.status === "active") {
      const project = await ctx.db.get(sprint.projectId);
      if (!project) throw new Error("Not found");

      const sprints = await ctx.db
        .query("sprints")
        .withIndex("by_project", (q) => q.eq("projectId", sprint.projectId))
        .collect();
      const activeSprint = sprints.find(
        (s) => s.status === "active" && s._id !== args.sprintId,
      );
      if (activeSprint) {
        throw new Error("Only one active sprint per project");
      }
    }

    await ctx.db.patch(args.sprintId, {
      status: args.status,
      updatedAt: Date.now(),
    });
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

    return await ctx.db
      .query("sprints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const get = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== orgId) {
      throw new Error("Not found");
    }
    return sprint;
  },
});

// ─── Log entries ─────────────────────────────────────────

export const addLogEntry = mutation({
  args: {
    sprintId: v.id("sprints"),
    type: v.union(
      v.literal("progress"),
      v.literal("note"),
      v.literal("blocker"),
      v.literal("defect"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== orgId) {
      throw new Error("Not found");
    }

    return await ctx.db.insert("logEntries", {
      orgId,
      sprintId: args.sprintId,
      type: args.type,
      content: args.content,
      author: userId,
      createdAt: Date.now(),
    });
  },
});

export const listLogEntries = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== orgId) {
      throw new Error("Not found");
    }

    return await ctx.db
      .query("logEntries")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .order("desc")
      .collect();
  },
});

// ─── Defects ─────────────────────────────────────────────

export const addDefect = mutation({
  args: {
    sprintId: v.id("sprints"),
    specId: v.id("specs"),
    title: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await getAuthUser(ctx);
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== orgId) {
      throw new Error("Not found");
    }
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();
    return await ctx.db.insert("defects", {
      orgId,
      sprintId: args.sprintId,
      specId: args.specId,
      title: args.title,
      description: args.description,
      severity: args.severity,
      status: "open",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── Internal for HTTP Actions ───────────────────────────

export const addLogEntryInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    sprintId: v.id("sprints"),
    type: v.union(
      v.literal("progress"),
      v.literal("note"),
      v.literal("blocker"),
      v.literal("defect"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    return await ctx.db.insert("logEntries", {
      orgId: args.orgId,
      sprintId: args.sprintId,
      type: args.type,
      content: args.content,
      author: args.userId,
      createdAt: Date.now(),
    });
  },
});

export const addDefectInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    sprintId: v.id("sprints"),
    specId: v.id("specs"),
    title: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
  },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint || sprint.orgId !== args.orgId) {
      throw new Error("Not found");
    }
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== args.orgId) {
      throw new Error("Not found");
    }

    const now = Date.now();
    return await ctx.db.insert("defects", {
      orgId: args.orgId,
      sprintId: args.sprintId,
      specId: args.specId,
      title: args.title,
      description: args.description,
      severity: args.severity,
      status: "open",
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
