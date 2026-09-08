// Import Internal Dependencies
import type {
  Actor,
  Event
} from "../EventStore.ts";

/**
 * An event as a backend stores it, with its JSON payloads still encoded.
 */
export interface EventFields {
  eventId: number;
  assetType: string;
  assetId: string;
  eventType: string;
  eventDataJson: string;
  eventVersion: number;
  actorJson: string;
  createdAt: string;
}

export function toJson(
  value: unknown,
  field: string
): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError(
      `${field} must be JSON-serializable`
    );
  }

  return json;
}

export function toStoredValue<T>(
  value: T,
  field: string
): T {
  return JSON.parse(
    toJson(value, field)
  ) as T;
}

export function materializeEvent(
  fields: EventFields
): Event {
  return {
    eventId: fields.eventId,
    assetType: fields.assetType,
    assetId: fields.assetId,
    eventType: fields.eventType,
    eventData: JSON.parse(fields.eventDataJson),
    eventVersion: fields.eventVersion,
    actor: JSON.parse(fields.actorJson) as Actor,
    createdAt: fields.createdAt
  };
}
