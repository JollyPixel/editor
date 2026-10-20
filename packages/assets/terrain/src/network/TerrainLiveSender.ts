// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import type {
  TileCoord,
  TileKey,
  TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TerrainPreview } from "../model/TerrainPreview.ts";
import { patchBatches } from "./patchBatches.ts";
import { encodeTilePatch } from "./tilePatches.ts";
import {
  TERRAIN_INTEREST_CHANGED,
  TERRAIN_LIVE_PATCHED,
  type InterestChangedMessage,
  type LivePatchedMessage
} from "./TerrainLive.schema.ts";
import type { TerrainInterest } from "./TerrainInterest.ts";

// CONSTANTS
export const LIVE_PATCH_INTERVAL = 100;

export interface TerrainLiveSenderOptions {
  room: Room;
  preview: TerrainPreview;
}

export class TerrainLiveSender {
  #room: Room;
  #preview: TerrainPreview;
  #interest: TerrainInterest | null = null;
  #queued = new Map<TileKey, TilePatch>();
  #sendTimer: ReturnType<typeof setTimeout> | null = null;

  #onSync = (): void => {
    if (this.#interest !== null) {
      this.#sendInterest(this.#interest);
    }
  };

  #onStrokeWritten = (
    patches: readonly TilePatch[]
  ): void => {
    for (const patch of patches) {
      this.#queued.set(patch.tile.key, patch);
    }
    if (this.#queued.size > 0 && this.#sendTimer === null) {
      this.#sendTimer = setTimeout(() => this.#flush(), LIVE_PATCH_INTERVAL);
    }
  };

  #onStrokeSettled = (
    tiles: readonly TileCoord[]
  ): void => {
    for (const tile of tiles) {
      this.#queued.delete(tile.key);
    }
  };

  constructor(
    options: TerrainLiveSenderOptions
  ) {
    this.#room = options.room;
    this.#preview = options.preview;
    this.#room.on("sync", this.#onSync);
    this.#preview.on("strokeWritten", this.#onStrokeWritten);
    this.#preview.on("strokeSettled", this.#onStrokeSettled);
  }

  get interest(): TerrainInterest | null {
    return this.#interest;
  }

  publishInterest(
    interest: TerrainInterest
  ): boolean {
    if (this.#interest !== null && interest.equals(this.#interest)) {
      return false;
    }

    this.#interest = interest;
    this.#sendInterest(interest);

    return true;
  }

  dispose(): void {
    this.#room.off("sync", this.#onSync);
    this.#preview.off("strokeWritten", this.#onStrokeWritten);
    this.#preview.off("strokeSettled", this.#onStrokeSettled);
    if (this.#sendTimer !== null) {
      clearTimeout(this.#sendTimer);
      this.#sendTimer = null;
    }
    this.#queued.clear();
  }

  #sendInterest(
    interest: TerrainInterest
  ): void {
    this.#room.send({
      action: TERRAIN_INTEREST_CHANGED,
      ...interest.toJSON()
    } satisfies InterestChangedMessage);
  }

  #flush(): void {
    this.#sendTimer = null;
    const tiles = Array.from(this.#queued.values(), encodeTilePatch);
    this.#queued.clear();
    for (const batch of patchBatches(tiles)) {
      this.#room.send({
        action: TERRAIN_LIVE_PATCHED,
        tiles: batch
      } satisfies LivePatchedMessage);
    }
  }
}
