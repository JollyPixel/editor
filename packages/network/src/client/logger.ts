// Import Third-party Dependencies
import {
  LogLayer,
  ConsoleTransport
} from "loglayer";

// Import Internal Dependencies
import type { Logger } from "../logger.ts";

export type { Logger };

export function createLogger(): Logger {
  return new LogLayer({
    transport: new ConsoleTransport({
      logger: console
    })
  });
}
