import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const listSpecs = query({
  args: {
    type: v.optional(
      v.union(v.literal("NF"), v.literal("BE"), v.literal("FE"), v.literal("DA")),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);

    // Get org specs
    let orgSpecs;
    if (args.type) {
      orgSpecs = await ctx.db
        .query("librarySpecs")
        .withIndex("by_org_and_type", (q) =>
          q.eq("orgId", orgId).eq("type", args.type!),
        )
        .collect();
    } else {
      orgSpecs = await ctx.db
        .query("librarySpecs")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    // Get public specs
    const publicSpecs = await ctx.db
      .query("librarySpecs")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();

    // Merge, dedup by _id
    const seen = new Set<string>();
    const results = [];
    for (const spec of [...orgSpecs, ...publicSpecs]) {
      if (!seen.has(spec._id)) {
        seen.add(spec._id);
        if (!args.type || spec.type === args.type) {
          results.push(spec);
        }
      }
    }

    return results;
  },
});

export const getSop = query({
  args: { sopId: v.id("librarySops") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthUser(ctx);
    const sop = await ctx.db.get(args.sopId);
    if (!sop) throw new Error("Not found");
    if (sop.orgId !== orgId && sop.visibility !== "public") {
      throw new Error("Not found");
    }
    return sop;
  },
});

// ─── Internal for HTTP Actions ───────────────────────────

export const listSpecsInternal = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const orgSpecs = await ctx.db
      .query("librarySpecs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const publicSpecs = await ctx.db
      .query("librarySpecs")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();

    const seen = new Set<string>();
    const results = [];
    for (const spec of [...orgSpecs, ...publicSpecs]) {
      if (!seen.has(spec._id)) {
        seen.add(spec._id);
        results.push(spec);
      }
    }
    return results;
  },
});

export const getSopInternal = internalQuery({
  args: { orgId: v.string(), sopId: v.id("librarySops") },
  handler: async (ctx, args) => {
    const sop = await ctx.db.get(args.sopId);
    if (!sop) return null;
    if (sop.orgId !== args.orgId && sop.visibility !== "public") return null;
    return sop;
  },
});
