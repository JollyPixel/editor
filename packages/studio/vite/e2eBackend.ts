// Import Third-party Dependencies
import type { StudioBackendOptions } from "@jolly-pixel/server/node";

// CONSTANTS
export const E2E_BACKEND_OPTIONS = {
  requestsPerMinute: 100_000,
  accounts: {
    defaultRole: "member",
    throttle: {
      registrations: 1_000
    }
  }
} as const satisfies Partial<StudioBackendOptions>;
