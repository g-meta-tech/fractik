"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export const create = action({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<{ keyId: Id<"apiKeys">; fullKey: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const orgId = identity.org_id as string | undefined;
    if (!orgId) throw new Error("No organization selected");

    const userId = identity.subject;

    const randomHex = crypto.randomBytes(32).toString("hex");
    const fullKey = `fk_live_${randomHex}`;
    const hashedKey = hashKey(fullKey);

    const keyId: Id<"apiKeys"> = await ctx.runMutation(internal.apiKeys.insertKey, {
      orgId,
      name: args.name,
      hashedKey,
      createdBy: userId,
    });

    return { keyId, fullKey };
  },
});

export const revokeByUser = action({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const orgId = identity.org_id as string | undefined;
    if (!orgId) throw new Error("No organization selected");

    await ctx.runMutation(internal.apiKeys.revoke, {
      keyId: args.keyId,
      orgId,
    });
  },
});
