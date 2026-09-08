// Import Internal Dependencies
import type {
  AppendInput,
  CompactOptions,
  CompactReport,
  Event,
  EventReader
} from "../EventStore.ts";

/**
 * Backend contract for assigning event identity and version.
 */
export interface EventLog extends EventReader {
  insert(
    input: AppendInput
  ): Event;
  compact(
    options: CompactOptions
  ): CompactReport;
  close(): void;
}

/**
 * Thrown by every backend when a log is used after `close()`.
 */
export class EventLogClosedError extends Error {
  constructor(
    options?: ErrorOptions
  ) {
    super("event log is closed", options);
  }
}
