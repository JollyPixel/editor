// Import Third-party Dependencies
import {
  BlankTransport,
  LogLayer,
  type ILogLayer
} from "loglayer";

export type Logger = ILogLayer;

/**
 * No-op logger used when the host does not supply one.
 */
export function silentLogger(): Logger {
  return new LogLayer({
    transport: new BlankTransport({
      shipToLogger: () => []
    })
  });
}
