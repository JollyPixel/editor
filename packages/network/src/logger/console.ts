// Import Third-party Dependencies
import {
  LogLayer,
  ConsoleTransport
} from "loglayer";

// Import Internal Dependencies
import type { Logger } from "./types.ts";

export function createLogger(): Logger {
  return new LogLayer({
    transport: new ConsoleTransport({
      logger: console
    })
  });
}

export type { Logger };
