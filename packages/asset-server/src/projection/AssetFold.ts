// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  type AssetEvent,
  type AssetInlineContent
} from "../events/AssetEvents.ts";
import { decodeContent } from "../events/inlineContent.ts";
import {
  applyProjection,
  type AssetProjection
} from "./applyProjection.ts";

export class AssetFold {
  projected: AssetProjection | null = null;
  desired: AssetProjection | null = null;
  desiredEventId = 0;
  #content: AssetInlineContent | null = null;

  get settled(): boolean {
    return this.projected === this.desired;
  }

  apply(
    event: AssetEvent,
    eventId: number
  ): void {
    this.desired = applyProjection(this.desired, event);
    this.desiredEventId = eventId;
    switch (event.eventType) {
      case ASSET_CREATED:
      case ASSET_UPDATED:
        this.#content = event.eventData.content;
        break;
      case ASSET_DELETED:
        this.#content = null;
        break;
      default:
        break;
    }
  }

  settle(
    projection: AssetProjection | null = this.desired
  ): void {
    this.projected = projection;
    if (this.settled) {
      this.#content = null;
    }
  }

  async read(
    source: AssetSource
  ): Promise<Uint8Array | null> {
    if (this.desired === null) {
      return null;
    }
    if (this.#content !== null) {
      return decodeContent(this.#content);
    }

    return this.projected === null ?
      null :
      source.read(this.projected.path);
  }
}
