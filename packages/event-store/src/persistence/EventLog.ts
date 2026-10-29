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
  ): Promise<EventTag>;
  get(
    assetId: string,
    name: string
  ): Promise<EventTag | undefined>;
  list(
    assetId?: string
  ): Promise<EventTag[]>;
  delete(
    assetId: string,
    name: string
  ): Promise<boolean>;
}

export interface EventJournal {
  putEvent(
    event: Event
  ): Promise<void>;
  deleteEvents(
    events: Iterable<Event>
  ): Promise<void>;
  putTag(
    tag: EventTag
  ): Promise<void>;
  deleteTag(
    assetId: string,
    name: string
  ): Promise<void>;
  close(): void;
}

export interface EventLog extends EventReader {
  readonly tags: TagLog;
  insert(
    input: AppendInput
  ): Promise<Event>;
  compact(
    options: CompactOptions
  ): Promise<CompactReport>;
  close(): Promise<void>;
}
