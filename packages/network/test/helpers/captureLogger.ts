// Import Third-party Dependencies
import {
  LogLayer,
  ConsoleTransport
} from "loglayer";

// Import Internal Dependencies
import type { Logger } from "#src/index.ts";

export interface CapturedLogger {
  logger: Logger;
  warnings: string[];
  errors: string[];
}

export function captureLogger(): CapturedLogger {
  const warnings: string[] = [];
  const errors: string[] = [];
  const logger = new LogLayer({
    transport: new ConsoleTransport({
      logger: {
        ...console,
        warn: (...args: unknown[]) => {
          warnings.push(args.map(String).join(" "));
        },
        error: (...args: unknown[]) => {
          errors.push(args.map(String).join(" "));
        }
      }
    })
  });

  return {
    logger,
    warnings,
    errors
  };
}
