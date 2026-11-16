// Import Third-party Dependencies
import type { ServerBackendOptions } from "@jolly-pixel/server/node";

// CONSTANTS
export const E2E_BACKEND_OPTIONS = {
  requestsPerMinute: 100_000,
  accountsPolicy: {
    defaultRole: "member",
    join: "open"
  },
  accounts: {
    throttle: {
      registrations: 1_000
    }
  }
} as const satisfies Partial<ServerBackendOptions>;
