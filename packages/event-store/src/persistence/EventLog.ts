// Import Internal Dependencies
import type {
  AppendInput,
  CompactOptions,
  CompactReport,
  Event,
  EventReader,
  EventTag,
  EventTagInput
} from "../EventStore.ts";

export interface TagLog {
  insert(
    input: EventTagInput
  ): EventTag;
  get(
    assetId: string,
    name: string
  ): EventTag | undefined;
  list(
    assetId?: string
  ): EventTag[];
  delete(
    assetId: string,
    name: string
  ): boolean;
}

export interface EventJournal {
  putEvent(
    event: Event
  ): void;
  deleteEvents(
    events: Iterable<Event>
  ): void;
  putTag(
    tag: EventTag
  ): void;
  deleteTag(
    assetId: string,
    name: string
  ): void;
  close(): void;
}

export interface EventLog extends EventReader {
  readonly tags: TagLog;
  insert(
    input: AppendInput
  ): Event;
  compact(
    options: CompactOptions
  ): CompactReport;
  close(): void;
}
