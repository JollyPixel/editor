// Import Third-party Dependencies
import type {
  Room,
  RoomPeerEvent
} from "@jolly-pixel/network/client";
import {
  ChunkCoord,
  TileCoord,
  type TileKey,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";
import { Emitter } from "@openally/emitt";
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  TerrainChange,
  TerrainCommandDocument
} from "../model/TerrainCommandDocument.ts";
import {
  decodeTilePatch,
  encodeTilePatch
} from "./tilePatches.ts";
import {
  peerLivePatchedSchema,
  TERRAIN_INTEREST_CHANGED,
  TERRAIN_LIVE_PATCHED,
  type InterestChangedMessage,
  type LivePatchedMessage
} from "./TerrainLive.schema.ts";
import type { TerrainInterest } from "./TerrainInterest.ts";

// CONSTANTS
export const LIVE_PATCH_INTERVAL = 100;
export const LIVE_PATCH_TIMEOUT = 5_000;

export interface TerrainLiveSyncOptions {
  room: Room;
  document: TerrainCommandDocument;
}

export type TerrainLiveSyncEvents = {
  tilesChanged: (tiles: readonly TileCoord[]) => void;
};

interface LiveBackup {
  readonly author: string;
  readonly tile: TileCoord;
  readonly heights: Float32Array;
}

export class TerrainLiveSync extends Emitter<TerrainLiveSyncEvents> {
  #room: Room;
  #document: TerrainCommandDocument;
  #interest: TerrainInterest | null = null;
  #queued = new Map<TileKey, TileCoord>();
  #sendTimer: ReturnType<typeof setTimeout> | null = null;
  #backups = new Map<TileKey, LiveBackup>();
  #expiries = new Map<string, ReturnType<typeof setTimeout>>();

  #onMessage = (
    message: unknown
  ): void => {
    const result = z.safeParse(peerLivePatchedSchema, message);
    if (result.success) {
      this.#receive(result.data.from, result.data.tiles);
    }
  };

  #onSync = (): void => {
    if (this.#interest !== null) {
      this.#sendInterest(this.#interest);
    }
  };

  #onPeerLeft = (
    { clientId }: RoomPeerEvent
  ): void => {
    this.#restore(clientId);
  };

  #onChange = (
    { command }: TerrainChange
  ): void => {
    if (command.action === "heights-patched") {
      for (const { x, z, tile } of command.tiles) {
        const coord = TileCoord.fromIndex(new ChunkCoord(x, z), tile);
        this.#backups.delete(coord.key);
        this.#queued.delete(coord.key);
      }

      return;
    }

    for (const [key, { tile }] of this.#backups) {
      if (tile.chunk.x === command.x && tile.chunk.z === command.z) {
        this.#backups.delete(key);
      }
    }
  };

  #onReset = (): void => {
    this.#backups.clear();
    this.#queued.clear();
  };

  constructor(
    options: TerrainLiveSyncOptions
  ) {
    super();

    this.#room = options.room;
    this.#document = options.document;
    this.#room.on("message", this.#onMessage);
    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#document.on("change", this.#onChange);
    this.#document.on("reset", this.#onReset);
  }

  publishInterest(
    interest: TerrainInterest
  ): void {
    if (interest.equals(this.#interest ?? undefined)) {
      return;
    }

    this.#interest = interest;
    this.#sendInterest(interest);
  }

  queue(
    tiles: Iterable<TileCoord>
  ): void {
    for (const tile of tiles) {
      this.#queued.set(tile.key, tile);
    }
    if (this.#queued.size > 0 && this.#sendTimer === null) {
      this.#sendTimer = setTimeout(() => this.#flush(), LIVE_PATCH_INTERVAL);
    }
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#document.off("change", this.#onChange);
    this.#document.off("reset", this.#onReset);
    if (this.#sendTimer !== null) {
      clearTimeout(this.#sendTimer);
    }
    for (const timer of this.#expiries.values()) {
      clearTimeout(timer);
    }
    this.#expiries.clear();
    this.#queued.clear();
    this.#backups.clear();
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
    const patches: TilePatch[] = [];
    for (const tile of this.#queued.values()) {
      const chunk = this.#document.terrain.chunk(tile.chunk);
      if (chunk !== undefined) {
        patches.push({
          tile,
          heights: chunk.tileHeights(tile.x, tile.z)
        });
      }
    }
    this.#queued.clear();
    if (patches.length === 0) {
      return;
    }

    this.#room.send({
      action: TERRAIN_LIVE_PATCHED,
      tiles: patches.map(encodeTilePatch)
    } satisfies LivePatchedMessage);
  }

  #receive(
    author: string,
    encoded: LivePatchedMessage["tiles"]
  ): void {
    const patches: TilePatch[] = [];
    for (const tile of encoded) {
      const patch = decodeTilePatch(tile);
      if (patch !== null && this.#document.terrain.has(patch.tile.chunk)) {
        patches.push(patch);
      }
    }
    if (patches.length === 0) {
      return;
    }

    const previous = this.#document.writeTiles(patches);
    for (const { tile, heights } of previous) {
      if (!this.#backups.has(tile.key)) {
        this.#backups.set(tile.key, { author, tile, heights });
      }
    }
    this.#scheduleExpiry(author);
    this.emit("tilesChanged", patches.map(({ tile }) => tile));
  }

  #scheduleExpiry(
    author: string
  ): void {
    const pending = this.#expiries.get(author);
    if (pending !== undefined) {
      clearTimeout(pending);
    }
    this.#expiries.set(
      author,
      setTimeout(() => this.#restore(author), LIVE_PATCH_TIMEOUT)
    );
  }

  #restore(
    author: string
  ): void {
    const pending = this.#expiries.get(author);
    if (pending !== undefined) {
      clearTimeout(pending);
      this.#expiries.delete(author);
    }

    const restored: TilePatch[] = [];
    for (const [key, backup] of this.#backups) {
      if (backup.author === author) {
        this.#backups.delete(key);
        if (this.#document.terrain.has(backup.tile.chunk)) {
          restored.push(backup);
        }
      }
    }
    if (restored.length === 0) {
      return;
    }

    this.#document.writeTiles(restored);
    this.emit("tilesChanged", restored.map(({ tile }) => tile));
  }
}
