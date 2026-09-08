// Import Third-party Dependencies
import type {
  TypedEventEmitter
} from "@openally/emitt";
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
};

export interface ListAllOptions {
  fromEventId?: number;
  eventTypePrefix?: string;
  limit?: number;
}

export interface EventWriter {
  append(
    input: AppendInput
  ): Result<Event, Error>;
}

export interface TypedEventWriter<
  TMap extends EventDataMap
> {
  append<K extends EventType<TMap>>(
    input: TypedAppendInput<TMap, K>
  ): Result<TypedEvent<TMap>, Error>;
}

export interface ListFromCheckpointsOptions {
  checkpointEventTypes: readonly string[];
  eventTypePrefix?: string;
}

export interface CompactOptions {
  checkpointEventTypes: readonly string[];
  /**
   * Reclaims freed storage when supported.
   * @default true
   */
  reclaim?: boolean;
}

export interface CompactReport {
  removed: number;
  assets: number;
}

export interface EventReader {
  list(
    assetId: string,
    fromVersion?: number
  ): Event[];

  lastVersionOf(
    assetId: string,
    eventTypes: readonly string[]
  ): number;

  listAll(
    options?: ListAllOptions
  ): Event[];

  listFromCheckpoints(
    options: ListFromCheckpointsOptions
  ): Event[];
}

export interface EventStore {
  readonly writer: EventWriter & TypedEventEmitter<EventStoreEventMap>;
  readonly reader: EventReader;

  compact(
    options: CompactOptions
  ): CompactReport;

  close(): void;
  [Symbol.dispose](): void;
}

export interface TypedEventStore<
  TMap extends EventDataMap
> extends EventStore {
  readonly writer:
    & TypedEventWriter<TMap>
    & TypedEventEmitter<EventStoreEventMap>;
}

export type EventStoreEventMap = {
  append: (
    event: Event
  ) => void;
  error: (
    error: Error,
    input: AppendInput
  ) => void;
};
