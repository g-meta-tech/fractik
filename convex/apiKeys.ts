import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const insertKey = internalMutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    hashedKey: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      orgId: args.orgId,
      name: args.name,
      hashedKey: args.hashedKey,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

export const revoke = internalMutation({
  args: { keyId: v.id("apiKeys"), orgId: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key || key.orgId !== args.orgId) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
  },
});

export const list = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return keys.map((k) => ({
      _id: k._id,
      name: k.name,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
    }));
  },
});

export const validate = internalQuery({
  args: { hashedKey: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("hashedKey", args.hashedKey))
      .unique();

    if (!key || key.revokedAt) return null;

    return {
      keyId: key._id,
      orgId: key.orgId,
      userId: key.createdBy,
    };
  },
});

export const touchLastUsed = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
