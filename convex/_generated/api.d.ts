/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as apiKeysActions from "../apiKeysActions.js";
import type * as capabilities from "../capabilities.js";
import type * as divergences from "../divergences.js";
import type * as features from "../features.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as library from "../library.js";
import type * as projects from "../projects.js";
import type * as specVersions from "../specVersions.js";
import type * as specs from "../specs.js";
import type * as sprints from "../sprints.js";
import type * as testCases from "../testCases.js";
import type * as userStories from "../userStories.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  apiKeysActions: typeof apiKeysActions;
  capabilities: typeof capabilities;
  divergences: typeof divergences;
  features: typeof features;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  library: typeof library;
  projects: typeof projects;
  specVersions: typeof specVersions;
  specs: typeof specs;
  sprints: typeof sprints;
  testCases: typeof testCases;
  userStories: typeof userStories;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
