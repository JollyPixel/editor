// Import Third-party Dependencies
import type {
  Room,
  RoomPeerEvent
} from "@jolly-pixel/network/client";
import type { TilePatch } from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { TerrainPreview } from "../model/TerrainPreview.ts";
import { decodeTilePatch } from "./tilePatches.ts";
import {
  peerLivePatchedSchema,
  type LivePatchedMessage
} from "./TerrainLive.schema.ts";

// CONSTANTS
export const LIVE_PATCH_TIMEOUT = 5_000;

export interface TerrainLiveReceiverOptions {
  room: Room;
  preview: TerrainPreview;
}

export class TerrainLiveReceiver {
  #room: Room;
  #preview: TerrainPreview;
  #expiries = new Map<string, ReturnType<typeof setTimeout>>();

  #onMessage = (
    message: unknown
  ): void => {
    const result = z.safeParse(peerLivePatchedSchema, message);
    if (result.success) {
      this.#receive(result.data.from, result.data.tiles);
    }
  };

  #onPeerLeft = (
    { clientId }: RoomPeerEvent
  ): void => {
    this.#expire(clientId);
  };

  constructor(
    options: TerrainLiveReceiverOptions
  ) {
    this.#room = options.room;
    this.#preview = options.preview;
    this.#room.on("message", this.#onMessage);
    this.#room.on("peer-left", this.#onPeerLeft);
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
    this.#room.off("peer-left", this.#onPeerLeft);
    for (const author of [...this.#expiries.keys()]) {
      this.#expire(author);
    }
  }

  #receive(
    author: string,
    encoded: LivePatchedMessage["tiles"]
  ): void {
    const patches: TilePatch[] = [];
    for (const tile of encoded) {
      const patch = decodeTilePatch(tile);
      if (patch !== null) {
        patches.push(patch);
      }
    }
    if (patches.length === 0) {
      return;
    }

    this.#preview.write(author, patches);
    const pending = this.#expiries.get(author);
    if (pending !== undefined) {
      clearTimeout(pending);
    }
    this.#expiries.set(
      author,
      setTimeout(() => this.#expire(author), LIVE_PATCH_TIMEOUT)
    );
  }

  #expire(
    author: string
  ): void {
    const pending = this.#expiries.get(author);
    if (pending !== undefined) {
      clearTimeout(pending);
      this.#expiries.delete(author);
    }
    this.#preview.drop(author);
  }
}
