// Import Third-party Dependencies
import {
  decodeBase64,
  encodeBase64
} from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  Actor,
  AppendInput,
  Event
} from "../EventStore.ts";

// CONSTANTS
const kBytesKey = "$bytes";
const kBytesMarker = `"${kBytesKey}"`;

export interface EventPosition {
  eventId: number;
  eventVersion: number;
}

export interface EventRecordFields {
  assetType: string;
  assetId: string;
  eventType: string;
  eventDataJson: string;
  actorJson: string;
  createdAt: string;
}

export class EventRecord implements EventRecordFields {
  readonly assetType: string;
  readonly assetId: string;
  readonly eventType: string;
  readonly eventDataJson: string;
  readonly actorJson: string;
  readonly createdAt: string;

  static encode(
    input: AppendInput
  ): EventRecord {
    return new EventRecord({
      assetType: input.assetType,
      assetId: input.assetId,
      eventType: input.eventType,
      eventDataJson: encodeJson(input.eventData, "eventData"),
      actorJson: encodeJson(input.actor, "actor"),
      createdAt: new Date().toISOString()
    });
  }

  constructor(
    fields: EventRecordFields
  ) {
    this.assetType = fields.assetType;
    this.assetId = fields.assetId;
    this.eventType = fields.eventType;
    this.eventDataJson = fields.eventDataJson;
    this.actorJson = fields.actorJson;
    this.createdAt = fields.createdAt;
  }

  toEvent(
    position: EventPosition
  ): Event {
    return {
      eventId: position.eventId,
      assetType: this.assetType,
      assetId: this.assetId,
      eventType: this.eventType,
      eventData: decodeJson(this.eventDataJson),
      eventVersion: position.eventVersion,
      actor: JSON.parse(this.actorJson) as Actor,
      createdAt: this.createdAt
    };
  }
}

export function encodeJson(
  value: unknown,
  field: string
): string {
  const json = JSON.stringify(value, function replaceBytes(key, replaced) {
    const original: unknown = (this as Record<string, unknown>)[key];
    if (original instanceof Uint8Array) {
      return {
        [kBytesKey]: encodeBase64(original)
      };
    }
    if (isObject(replaced) && Object.hasOwn(replaced, kBytesKey)) {
      throw new TypeError(
        `${field} must not hold the reserved key "${kBytesKey}"`
      );
    }

    return replaced;
  });
  if (json === undefined) {
    throw new TypeError(
      `${field} must be JSON-serializable`
    );
  }

  return json;
}

export function decodeJson(
  json: string
): unknown {
  if (!json.includes(kBytesMarker)) {
    return JSON.parse(json);
  }

  return JSON.parse(json, (_key, value: unknown) => {
    if (!isObject(value) || typeof value[kBytesKey] !== "string") {
      return value;
    }

    return Object.keys(value).length === 1 ?
      decodeBase64(value[kBytesKey]) ?? value :
      value;
  });
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}
