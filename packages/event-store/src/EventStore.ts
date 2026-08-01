// Import Third-party Dependencies
import type { TypedEventEmitter } from "@openally/emitt";
import type { Result } from "@openally/result";

export interface Event {
  eventId: number;
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  eventVersion: number;
  createdAt: string;
}

export interface AppendInput {
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
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
