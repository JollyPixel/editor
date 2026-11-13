// Import Third-party Dependencies
import {
  ACCOUNTS_ERROR_CODES,
  ACCOUNTS_REQUEST_ERROR_CODES
} from "@jolly-pixel/accounts";
import * as z from "zod";

// CONSTANTS
const kApiFailureCodes = [
  ...ACCOUNTS_ERROR_CODES,
  ...ACCOUNTS_REQUEST_ERROR_CODES,
  "refused",
  "invalid-settings",
  "role-in-use",
  "stale-settings",
  "build-failed",
  "not-exportable"
] as const;

export type ApiFailureCode = typeof kApiFailureCodes[number];

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRoute {
  readonly method: ApiMethod;
  readonly path: string;
}

export const apiFailureSchema = z.object({
  code: z.enum(kApiFailureCodes).catch("unknown"),
  message: z.string()
});

export type ApiFailure = z.infer<typeof apiFailureSchema>;
