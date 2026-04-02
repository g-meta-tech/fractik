import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

export async function getAuthUser(
  ctx: QueryCtx | MutationCtx | ActionCtx
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const orgId = identity.org_id as string | undefined;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return {
    userId: identity.subject,
    orgId,
    name: identity.name ?? "Unknown",
    email: identity.email ?? "",
  };
}
