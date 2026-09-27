// Import Third-party Dependencies
import {
  LogLayer,
  ConsoleTransport
} from "loglayer";

// Import Internal Dependencies
import type { Logger } from "#src/index.ts";

export function captureLogger(): { logger: Logger; warnings: string[]; } {
  const warnings: string[] = [];
  const logger = new LogLayer({
    transport: new ConsoleTransport({
      logger: {
        ...console,
        warn: (...args: unknown[]) => {
          warnings.push(args.map(String).join(" "));
        }
      }
    })
  });

  return {
    logger,
    warnings
  };
}
