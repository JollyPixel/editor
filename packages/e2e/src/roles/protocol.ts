// Import Third-party Dependencies
import type { RightsMap } from "@jolly-pixel/network";

export const ROLE_COOKIE = "jolly_e2e_role";
export const SUBJECT_COOKIE = "jolly_e2e_subject";
export const REVOKE_PATH = "/__e2e/revoke";
export const DEFAULT_ROLE = "member";
export const RIGHTS = {
  member: {
    "*": "write"
  },
  spectator: {
    "*.$join": "write",
    "*.$presence": "write",
    "*": "read"
  }
} as const satisfies RightsMap;
