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
