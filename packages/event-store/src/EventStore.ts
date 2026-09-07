// Import Third-party Dependencies
import type { TypedEventEmitter } from "@openally/emitt";
import type { Result } from "@openally/result";

/** Identifies the origin of an appended event. */
export type Actor =
  | { type: "user"; id: string; }
  | { type: "system"; source: string; };

export interface Event {
  eventId: number;
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  eventVersion: number;
  actor: Actor;
  createdAt: string;
}

export interface AppendInput {
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  actor: Actor;
}

export interface ListAllOptions {
  /**
   * Returns events with an eventId greater than this value.
   * @default 0
   */
  fromEventId?: number;
  /** Matches event types by prefix. */
  eventTypePrefix?: string;
  /** Maximum events to return. */
  limit?: number;
}

export interface EventWriter {
  append(
    input: AppendInput
  ): Result<Event, Error>;
}

export interface ListFromCheckpointsOptions {
  /**
   * Event types that replace an asset's whole state. The newest one on each
   * asset bounds the slice returned for that asset.
   */
  checkpointEventTypes: readonly string[];
  eventTypePrefix?: string;
}

export interface CompactOptions {
  /**
   * Event types that replace an asset's whole state. Events stored before
   * an asset's newest one are superseded and removed.
   */
  checkpointEventTypes: readonly string[];
  /**
   * Reclaims the space freed by the removal. Backends holding no file
   * ignore it.
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

  /**
   * Returns the newest matching version for one asset, or `0`.
   * Event types are matched exactly.
   */
  lastVersionOf(
    assetId: string,
    eventTypes: readonly string[]
  ): number;

  /** Lists every stream in eventId order. */
  listAll(
    options?: ListAllOptions
  ): Event[];

  /**
   * Lists, per asset, its newest checkpoint event and everything appended
   * after it, across every stream in eventId order.
   *
   * An asset holding no checkpoint yields its whole stream. A reader whose
   * fold restarts from a checkpoint uses this instead of `listAll` so its
   * cost tracks current state rather than history depth.
   */
  listFromCheckpoints(
    options: ListFromCheckpointsOptions
  ): Event[];
}

export interface EventStore {
  readonly writer: EventWriter & TypedEventEmitter<EventStoreEventMap>;
  readonly reader: EventReader;

  /**
   * Removes every event stored before each asset's newest checkpoint.
   *
   * Destructive and irreversible. Surviving events keep their event ids and
   * versions, so a position held elsewhere stays valid.
   */
  compact(
    options: CompactOptions
  ): CompactReport;

  close(): void;
  [Symbol.dispose](): void;
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
