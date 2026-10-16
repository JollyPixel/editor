// Import Internal Dependencies
import type { StudioBackendOptions } from "../server/StudioBackend.ts";

// CONSTANTS
export const E2E_BACKEND_OPTIONS = {
  requestsPerMinute: 100_000,
  accounts: {
    inMemory: true,
    defaultRole: "member",
    throttle: {
      registrations: 1_000
    }
  }
} as const satisfies StudioBackendOptions;
