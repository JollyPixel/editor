// Import Third-party Dependencies
import pino from "pino";
import {
  LogLayer,
  type ILogLayer
} from "loglayer";
import { PinoTransport } from "@loglayer/transport-pino";

export type Logger = ILogLayer;

export function createLogger(
  name = "network"
): Logger {
  return new LogLayer({
    transport: new PinoTransport({
      logger: pino({ name })
    })
  });
}
