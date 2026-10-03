// Import Third-party Dependencies
import pino from "pino";
import {
  LogLayer,
  LogLevel,
  type LogLevelType
} from "loglayer";
import { PinoTransport } from "@loglayer/transport-pino";

// Import Internal Dependencies
import type { Logger } from "../logger.ts";

export type { Logger };

// CONSTANTS
const kLogLevels = new Set<string>(Object.values(LogLevel));

export function createLogger(
  name = "network"
): Logger {
  const logger = pino({ name });
  const logLayer = new LogLayer({
    transport: new PinoTransport({ logger })
  });

  return isLogLevel(logger.level) ?
    logLayer.setLevel(logger.level) :
    logLayer.disableLogging();
}

function isLogLevel(
  level: string
): level is LogLevelType {
  return kLogLevels.has(level);
}
