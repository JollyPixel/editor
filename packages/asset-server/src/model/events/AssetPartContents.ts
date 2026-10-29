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
  #held = new Map<number, Promise<HeldParts>>();

  constructor(
    reader: AssetPartReader,
    assetId: string
  ) {
    this.#reader = reader;
    this.#assetId = assetId;
  }

  async read(
    partId: string,
    at: number
  ): Promise<Uint8Array> {
    const entry = (await this.#heldAt(at)).get(partId);
    if (entry === undefined || !("content" in entry)) {
      throw new Error(
        `Part "${partId}" of asset "${this.#assetId}" is missing from version ${at}.`
      );
    }

    return decodeContent(entry.content);
  }

  #heldAt(
    at: number
  ): Promise<HeldParts> {
    let held = this.#held.get(at);
    if (held === undefined) {
      held = this.#load(at);
      this.#held.set(at, held);
    }

    return held;
  }

  async #load(
    at: number
  ): Promise<HeldParts> {
    const event = await this.#reader.get(this.#assetId, at);
    const parsed = event === undefined ? null : parseAssetEvent(event);
    const data = parsed?.ok === true ? parsed.val.eventData : null;

    return new Map(
      data !== null && "parts" in data ? Object.entries(data.parts ?? {}) : []
    );
  }
}
