// Import Third-party Dependencies
import pino from "pino";
import { LogLayer } from "loglayer";
import { PinoTransport } from "@loglayer/transport-pino";

// Import Internal Dependencies
import type { Logger } from "./types.ts";

/**
 * Node-side default logger. Kept out of `types.ts` (which only imports
 * loglayer's types) so pino itself stays out of browser consumers (`Client`).
 */
export function createLogger(
  name = "network"
): Logger {
  return new LogLayer({
    transport: new PinoTransport({
      logger: pino({ name })
    })
  });
}

export type { Logger };
