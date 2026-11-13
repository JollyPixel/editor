// Import Internal Dependencies
import type {
  Actor,
  AppendInput,
  Event
} from "../EventStore.ts";
import {
  decodeJsonWithBytes,
  encodeJson,
  encodeJsonWithBytes
} from "./jsonWithBytes.ts";

export interface EventPosition {
  eventId: number;
  eventVersion: number;
}

export interface EventRecordFields {
  assetType: string;
  assetId: string;
  eventType: string;
  eventDataJson: string;
  eventBytes: Uint8Array | null;
  actorJson: string;
  createdAt: string;
}

export class EventRecord implements EventRecordFields {
  readonly assetType: string;
  readonly assetId: string;
  readonly eventType: string;
  readonly eventDataJson: string;
  readonly eventBytes: Uint8Array | null;
  readonly actorJson: string;
  readonly createdAt: string;

  static encode(
    input: AppendInput
  ): EventRecord {
    const eventData = encodeJsonWithBytes(input.eventData, "eventData");

    return new EventRecord({
      assetType: input.assetType,
      assetId: input.assetId,
      eventType: input.eventType,
      eventDataJson: eventData.json,
      eventBytes: eventData.bytes,
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
    this.eventBytes = fields.eventBytes;
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
      eventData: decodeJsonWithBytes({
        json: this.eventDataJson,
        bytes: this.eventBytes
      }),
      eventVersion: position.eventVersion,
      actor: JSON.parse(this.actorJson) as Actor,
      createdAt: this.createdAt
    };
  }
}
