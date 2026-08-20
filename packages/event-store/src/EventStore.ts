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

export interface EventReader {
  list(
    assetId: string,
    fromVersion?: number
  ): Event[];

  /** Lists every stream in eventId order. */
  listAll(
    options?: ListAllOptions
  ): Event[];
}

export interface EventStore {
  readonly writer: EventWriter & TypedEventEmitter<EventStoreEventMap>;
  readonly reader: EventReader;
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
