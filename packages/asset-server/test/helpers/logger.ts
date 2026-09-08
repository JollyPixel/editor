// Import Third-party Dependencies
import {
  BlankTransport,
  LogLayer
} from "loglayer";

// Import Internal Dependencies
import type { Logger } from "#src/index.ts";

export interface RecordedLog {
  readonly level: string;
  readonly message: string;
  readonly metadata: Record<string, unknown>;
}

export interface RecordingLogger {
  readonly logger: Logger;
  readonly records: readonly RecordedLog[];
}

export function recordingLogger(): RecordingLogger {
  const records: RecordedLog[] = [];

  const logger = new LogLayer({
    transport: new BlankTransport({
      shipToLogger: ({ logLevel, messages, data }) => {
        records.push({
          level: logLevel,
          message: messages.join(" "),
          metadata: data ?? {}
        });

        return [];
      }
    })
  });

  return {
    logger,
    records
  };
}
