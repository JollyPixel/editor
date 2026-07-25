// Import Third-party Dependencies
import pino from "pino";

// Import Internal Dependencies
import type { Logger } from "./types.ts";

/**
 * Node-side default logger. Kept out of `types.ts` so browser consumers
 * (`Client`) never pull pino in even as a type-only import.
 */
export function createDefaultLogger(
  name = "network"
): Logger {
  return pino({ name });
}
