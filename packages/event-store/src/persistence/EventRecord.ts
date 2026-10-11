// Import Internal Dependencies
import type {
  Actor,
  AppendInput,
  Event
} from "../EventStore.ts";

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
      eventData: JSON.parse(this.eventDataJson),
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
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError(
      `${field} must be JSON-serializable`
    );
  }

  return json;
}
