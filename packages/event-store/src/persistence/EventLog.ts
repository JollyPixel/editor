// Import Internal Dependencies
import type {
  AppendInput,
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
  close(): void;
}
