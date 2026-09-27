// Import Third-party Dependencies
import pino from "pino";
import { LogLayer } from "loglayer";
import { PinoTransport } from "@loglayer/transport-pino";

// Import Internal Dependencies
import type { Logger } from "../logger.ts";

export type { Logger };

export function createLogger(
  name = "network"
): Logger {
  return new LogLayer({
    transport: new PinoTransport({
      logger: pino({ name })
    })
  });
}
