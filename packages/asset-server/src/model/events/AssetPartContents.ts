// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { AssetPartEntry } from "./AssetEvents.ts";
import { decodeContent } from "./inlineContent.ts";
import { parseWriteEvent } from "./parseWriteEvent.ts";

export type AssetPartReader = Pick<EventStore.EventReader, "get">;
export type AssetHeldParts = ReadonlyMap<string, Uint8Array>;
export type AssetHeldPartRefs = ReadonlyMap<string, number>;

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
    const event = parseWriteEvent(await this.#reader.get(this.#assetId, at));

    return new Map(Object.entries(event?.eventData.parts ?? {}));
  }
}

export function heldPartRefs(
  event: EventStore.Event
): AssetHeldPartRefs {
  const refs = new Map<string, number>();
  const parts = parseWriteEvent(event)?.eventData.parts ?? {};
  for (const [partId, entry] of Object.entries(parts)) {
    if (!("content" in entry)) {
      refs.set(partId, entry.at);
    }
  }

  return refs;
}

export async function loadHeldParts(
  assetId: string,
  refs: AssetHeldPartRefs,
  reader: AssetPartReader
): Promise<AssetHeldParts> {
  const held = new Map<string, Uint8Array>();
  const contents = new AssetPartContents(reader, assetId);
  for (const [partId, at] of refs) {
    held.set(partId, await contents.read(partId, at));
  }

  return held;
}
