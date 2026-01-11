/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as communications from "../communications.js";
import type * as companies from "../companies.js";
import type * as complianceSnapshots from "../complianceSnapshots.js";
import type * as cronJobLogs from "../cronJobLogs.js";
import type * as cronJobs from "../cronJobs.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as documents from "../documents.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as exceptions from "../exceptions.js";
import type * as insuranceRequirements from "../insuranceRequirements.js";
import type * as integrations from "../integrations.js";
import type * as notifications from "../notifications.js";
import type * as portal from "../portal.js";
import type * as projectSubcontractors from "../projectSubcontractors.js";
import type * as projects from "../projects.js";
import type * as requirementTemplates from "../requirementTemplates.js";
import type * as subcontractors from "../subcontractors.js";
import type * as users from "../users.js";
import type * as verifications from "../verifications.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  communications: typeof communications;
  companies: typeof companies;
  complianceSnapshots: typeof complianceSnapshots;
  cronJobLogs: typeof cronJobLogs;
  cronJobs: typeof cronJobs;
  crons: typeof crons;
  dashboard: typeof dashboard;
  documents: typeof documents;
  emailTemplates: typeof emailTemplates;
  exceptions: typeof exceptions;
  insuranceRequirements: typeof insuranceRequirements;
  integrations: typeof integrations;
  notifications: typeof notifications;
  portal: typeof portal;
  projectSubcontractors: typeof projectSubcontractors;
  projects: typeof projects;
  requirementTemplates: typeof requirementTemplates;
  subcontractors: typeof subcontractors;
  users: typeof users;
  verifications: typeof verifications;
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
