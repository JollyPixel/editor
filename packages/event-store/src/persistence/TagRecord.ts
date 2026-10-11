// Import Internal Dependencies
import type {
  Actor,
  EventTag,
  EventTagInput
} from "../EventStore.ts";
import { encodeJson } from "./EventRecord.ts";

export interface TagRecordFields {
  assetId: string;
  name: string;
  eventVersion: number;
  message: string | null;
  actorJson: string;
  createdAt: string;
}

export class TagRecord implements TagRecordFields {
  readonly assetId: string;
  readonly name: string;
  readonly eventVersion: number;
  readonly message: string | null;
  readonly actorJson: string;
  readonly createdAt: string;

  static encode(
    input: EventTagInput
  ): TagRecord {
    if (input.name.length === 0) {
      throw new TypeError("tag name must not be empty");
    }

    return new TagRecord({
      assetId: input.assetId,
      name: input.name,
      eventVersion: input.eventVersion,
      message: input.message ?? null,
      actorJson: encodeJson(input.actor, "actor"),
      createdAt: new Date().toISOString()
    });
  }

  constructor(
    fields: TagRecordFields
  ) {
    this.assetId = fields.assetId;
    this.name = fields.name;
    this.eventVersion = fields.eventVersion;
    this.message = fields.message;
    this.actorJson = fields.actorJson;
    this.createdAt = fields.createdAt;
  }

  toEventTag(): EventTag {
    const tag: EventTag = {
      assetId: this.assetId,
      name: this.name,
      eventVersion: this.eventVersion,
      actor: JSON.parse(this.actorJson) as Actor,
      createdAt: this.createdAt
    };
    if (this.message !== null) {
      tag.message = this.message;
    }

    return tag;
  }
}
