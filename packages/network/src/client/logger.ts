// Import Third-party Dependencies
import {
  LogLayer,
  ConsoleTransport,
  type ILogLayer
} from "loglayer";

export type Logger = ILogLayer;

export function createLogger(): Logger {
  return new LogLayer({
    transport: new ConsoleTransport({
      logger: console
    })
  });
}
