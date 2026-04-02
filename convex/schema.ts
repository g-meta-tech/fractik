import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Projects ──────────────────────────────────────────

  projects: defineTable({
    orgId: v.string(),
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    visionContent: v.string(),
    visionVersionNumber: v.number(),
    isPublic: v.boolean(),
    githubRepoUrl: v.optional(v.string()),
    githubConnectionId: v.optional(v.id("githubConnections")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_and_slug", ["orgId", "slug"]),

  visionVersions: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    content: v.string(),
    versionNumber: v.number(),
    changeNote: v.string(),
    changedBy: v.string(),
    changedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // ─── Hierarchy ─────────────────────────────────────────

  capabilities: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("defined"),
      v.literal("in_progress"),
      v.literal("done"),
    ),
    sortOrder: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_org", ["orgId"]),

  features: defineTable({
    orgId: v.string(),
    capabilityId: v.id("capabilities"),
    name: v.string(),
    description: v.string(),
    acceptanceCriteria: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        sortOrder: v.number(),
      }),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("defined"),
      v.literal("spec_ready"),
      v.literal("in_progress"),
      v.literal("done"),
    ),
    sortOrder: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_capability", ["capabilityId"])
    .index("by_org", ["orgId"]),

  userStories: defineTable({
    orgId: v.string(),
    featureId: v.id("features"),
    persona: v.string(),
    action: v.string(),
    benefit: v.string(),
    criteria: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        sortOrder: v.number(),
      }),
    ),
    sortOrder: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_feature", ["featureId"])
    .index("by_org", ["orgId"]),

  specs: defineTable({
    orgId: v.string(),
    featureId: v.id("features"),
    type: v.union(
      v.literal("NF"),
      v.literal("BE"),
      v.literal("FE"),
      v.literal("DA"),
    ),
    title: v.string(),
    content: v.string(),
    technicalNotes: v.optional(v.string()),
    constraints: v.optional(v.string()),
    dependencies: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("reviewed"),
      v.literal("approved"),
      v.literal("implemented"),
      v.literal("deprecated"),
    ),
    isDesignSystem: v.optional(v.boolean()),
    isDataModel: v.optional(v.boolean()),
    versionNumber: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_feature", ["featureId"])
    .index("by_org", ["orgId"])
    .index("by_org_and_type", ["orgId", "type"]),

  specVersions: defineTable({
    orgId: v.string(),
    specId: v.id("specs"),
    content: v.string(),
    versionNumber: v.number(),
    changeNote: v.string(),
    changedBy: v.string(),
    changedAt: v.number(),
  }).index("by_spec", ["specId"]),

  testCases: defineTable({
    orgId: v.string(),
    specId: v.id("specs"),
    type: v.union(
      v.literal("unit"),
      v.literal("integration"),
      v.literal("e2e"),
      v.literal("manual"),
    ),
    title: v.string(),
    preconditions: v.string(),
    steps: v.array(
      v.object({
        id: v.string(),
        action: v.string(),
        expectedResult: v.string(),
        sortOrder: v.number(),
      }),
    ),
    status: v.union(
      v.literal("defined"),
      v.literal("passing"),
      v.literal("failing"),
      v.literal("skipped"),
      v.literal("blocked"),
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spec", ["specId"])
    .index("by_org", ["orgId"])
    .index("by_org_and_type", ["orgId", "type"]),

  testStatusLog: defineTable({
    orgId: v.string(),
    testCaseId: v.id("testCases"),
    previousStatus: v.string(),
    newStatus: v.string(),
    note: v.optional(v.string()),
    changedBy: v.string(),
    changedAt: v.number(),
  }).index("by_test_case", ["testCaseId"]),

  // ─── Implementation Control ────────────────────────────

  sprints: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed"),
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_org", ["orgId"]),

  sprintItems: defineTable({
    orgId: v.string(),
    sprintId: v.id("sprints"),
    entityType: v.union(v.literal("spec"), v.literal("test")),
    entityId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("verified"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_org", ["orgId"]),

  logEntries: defineTable({
    orgId: v.string(),
    sprintId: v.id("sprints"),
    type: v.union(
      v.literal("progress"),
      v.literal("note"),
      v.literal("blocker"),
      v.literal("defect"),
    ),
    content: v.string(),
    author: v.string(),
    createdAt: v.number(),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_org", ["orgId"]),

  defects: defineTable({
    orgId: v.string(),
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
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_spec", ["specId"])
    .index("by_org", ["orgId"]),

  // ─── Library ───────────────────────────────────────────

  librarySpecs: defineTable({
    orgId: v.string(),
    type: v.union(
      v.literal("NF"),
      v.literal("BE"),
      v.literal("FE"),
      v.literal("DA"),
    ),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    visibility: v.union(v.literal("public"), v.literal("org")),
    versionNumber: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_visibility", ["visibility"])
    .index("by_org_and_type", ["orgId", "type"]),

  librarySops: defineTable({
    orgId: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("auth"),
      v.literal("deploy"),
      v.literal("database"),
      v.literal("api"),
      v.literal("email"),
      v.literal("cms"),
      v.literal("monitoring"),
      v.literal("other"),
    ),
    tags: v.array(v.string()),
    visibility: v.union(v.literal("public"), v.literal("org")),
    versionNumber: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_visibility", ["visibility"])
    .index("by_org_and_category", ["orgId", "category"]),

  // ─── Agent Interface ───────────────────────────────────

  apiKeys: defineTable({
    orgId: v.string(),
    name: v.string(),
    hashedKey: v.string(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_hash", ["hashedKey"]),

  // ─── Divergences ───────────────────────────────────────

  divergences: defineTable({
    orgId: v.string(),
    specId: v.id("specs"),
    sprintId: v.optional(v.id("sprints")),
    type: v.union(
      v.literal("deviation"),
      v.literal("enhancement"),
      v.literal("issue"),
    ),
    description: v.string(),
    reportedBy: v.string(),
    decision: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    decisionNote: v.optional(v.string()),
    decidedBy: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_spec", ["specId"])
    .index("by_sprint", ["sprintId"])
    .index("by_org", ["orgId"])
    .index("by_org_and_decision", ["orgId", "decision"]),

  // ─── Repo Intelligence ─────────────────────────────────

  githubConnections: defineTable({
    orgId: v.string(),
    projectId: v.id("projects"),
    repoUrl: v.string(),
    owner: v.string(),
    repo: v.string(),
    tokenEncrypted: v.string(),
    status: v.union(
      v.literal("connected"),
      v.literal("disconnected"),
      v.literal("error"),
    ),
    lastSyncAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_org", ["orgId"]),
});
