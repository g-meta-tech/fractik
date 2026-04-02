import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const listBySpec = query({
  args: { specId: v.id("specs") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== orgId) {
      throw new Error("Not found");
    }

    const versions = await ctx.db
      .query("specVersions")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
      .order("desc")
      .collect();

    return versions.map((ver) => ({
      _id: ver._id,
      versionNumber: ver.versionNumber,
      changeNote: ver.changeNote,
      changedBy: ver.changedBy,
      changedAt: ver.changedAt,
    }));
  },
});

export const get = query({
  args: { versionId: v.id("specVersions") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const version = await ctx.db.get(args.versionId);
    if (!version || version.orgId !== orgId) {
      throw new Error("Not found");
    }
    return version;
  },
});

// ─── Internal for HTTP Actions ───────────────────────────

export const listBySpecInternal = internalQuery({
  args: { orgId: v.string(), specId: v.id("specs") },
  handler: async (ctx, args) => {
    const spec = await ctx.db.get(args.specId);
    if (!spec || spec.orgId !== args.orgId) return [];

    const versions = await ctx.db
      .query("specVersions")
      .withIndex("by_spec", (q) => q.eq("specId", args.specId))
      .order("desc")
      .collect();

    return versions.map((ver) => ({
      _id: ver._id,
      versionNumber: ver.versionNumber,
      changeNote: ver.changeNote,
      changedBy: ver.changedBy,
      changedAt: ver.changedAt,
    }));
  },
});
