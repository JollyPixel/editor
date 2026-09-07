// Import Third-party Dependencies
import {
  BlankTransport,
  LogLayer,
  type ILogLayer
} from "loglayer";

export type Logger = ILogLayer;

export function silentLogger(): Logger {
  return new LogLayer({
    transport: new BlankTransport({
      shipToLogger: () => []
    })
  });
}
