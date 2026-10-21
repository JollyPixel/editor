// Import Third-party Dependencies
import type {
  Result
} from "@openally/result";

type ActorUser = {
  type: "user";
  id: string;
};
type ActorSystem = {
  type: "system";
  source: string;
};
export type Actor = ActorUser | ActorSystem;

export type EventDataMap = Record<string, unknown>;

export type EventType<
  TMap extends EventDataMap
> = keyof TMap & string;

interface EventEnvelope {
  eventId: number;
  assetType: string;
  assetId: string;
  eventVersion: number;
  actor: Actor;
  createdAt: string;
}

export interface Event extends EventEnvelope {
  eventType: string;
  eventData: unknown;
}

export type TypedEvent<
  TMap extends EventDataMap
> = {
  [K in EventType<TMap>]: EventEnvelope & {
    eventType: K;
    eventData: TMap[K];
  };
}[EventType<TMap>];

export interface AppendInput {
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  actor: Actor;
  expectedVersion?: number;
}

export type TypedAppendInput<
  TMap extends EventDataMap,
  K extends EventType<TMap> = EventType<TMap>
> = {
  assetType: string;
  assetId: string;
  eventType: K;
  eventData: TMap[K];
  actor: Actor;
  expectedVersion?: number;
};

export interface ListAllOptions {
  fromEventId?: number;
  beforeEventId?: number;
  eventTypePrefix?: string;
  limit?: number;
  newestFirst?: boolean;
}

export interface EventWriter {
  append(
    input: AppendInput
  ): Result<Event, Error>;
}

export interface TypedEventWriter<
  TMap extends EventDataMap
> {
  append: <K extends EventType<TMap>>(
    input: TypedAppendInput<TMap, K>
  ) => Result<Event, Error>;
}

export interface ListFromCheckpointsOptions {
  checkpointEventTypes: readonly string[];
  eventTypePrefix?: string;
  assetId?: string;
}

export interface EventPosition {
  assetId: string;
  eventVersion: number;
}

export interface CompactOptions {
  checkpointEventTypes: readonly string[];
  /**
   * Reclaims freed storage when supported.
   * @default true
   */
  reclaim?: boolean;
  assetId?: string;
  /**
   * Events compaction leaves in place, as a tag does.
   */
  keep?: Iterable<EventPosition>;
}

export interface CompactReport {
  removed: number;
  assets: number;
}

export interface EventTagInput {
  assetId: string;
  name: string;
  eventVersion: number;
  message?: string;
  actor: Actor;
}

export interface EventTag extends EventTagInput {
  createdAt: string;
}

export interface EventTags {
  create(
    input: EventTagInput
  ): Result<EventTag, Error>;
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

export interface EventReader {
  get(
    assetId: string,
    eventVersion: number
  ): Event | undefined;

  list(
    assetId: string,
    fromVersion?: number
  ): Event[];

  listAll(
    options?: ListAllOptions
  ): Event[];

  listFromCheckpoints(
    options: ListFromCheckpointsOptions
  ): Event[];
}

export interface SubscribeOptions {
  eventTypePrefix?: string;
}

export type EventListener = (
  event: Event
) => void;

export type RejectionListener = (
  error: Error,
  input: AppendInput
) => void;

export interface EventStore {
  readonly writer: EventWriter;
  readonly reader: EventReader;
  readonly tags: EventTags;

  subscribe(
    listener: EventListener,
    options?: SubscribeOptions
  ): () => void;

  subscribeRejections(
    listener: RejectionListener
  ): () => void;

  compact(
    options: CompactOptions
  ): CompactReport;

  close(): void;
  [Symbol.dispose](): void;
}

export interface TypedEventStore<
  TMap extends EventDataMap
> extends EventStore {
  readonly writer: TypedEventWriter<TMap>;
}
