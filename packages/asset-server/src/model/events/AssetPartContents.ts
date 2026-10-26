// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  parseAssetEvent,
  type AssetPartEntry
} from "./AssetEvents.ts";
import { decodeContent } from "./inlineContent.ts";

export type AssetPartReader = Pick<EventStore.EventReader, "get">;

type HeldParts = ReadonlyMap<string, AssetPartEntry>;

export class AssetPartContents {
  #reader: AssetPartReader;
  #assetId: string;
  #held = new Map<number, HeldParts>();

  constructor(
    reader: AssetPartReader,
    assetId: string
  ) {
    this.#reader = reader;
    this.#assetId = assetId;
  }

  read(
    partId: string,
    at: number
  ): Uint8Array {
    const entry = this.#heldAt(at).get(partId);
    if (entry === undefined || !("content" in entry)) {
      throw new Error(
        `Part "${partId}" of asset "${this.#assetId}" is missing from version ${at}.`
      );
    }

    return decodeContent(entry.content);
  }

  #heldAt(
    at: number
  ): HeldParts {
    const known = this.#held.get(at);
    if (known !== undefined) {
      return known;
    }

    const event = this.#reader.get(this.#assetId, at);
    const parsed = event === undefined ? null : parseAssetEvent(event);
    const data = parsed?.ok === true ? parsed.val.eventData : null;
    const held = new Map(
      data !== null && "parts" in data ? Object.entries(data.parts ?? {}) : []
    );
    this.#held.set(at, held);

    return held;
  }
}
