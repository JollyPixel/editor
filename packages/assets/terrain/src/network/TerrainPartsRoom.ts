// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata,
  Right,
  Room,
  RoomEventMap,
  RoomRights
} from "@jolly-pixel/network/client";
import {
  ASSET_ROOM_MAX_PARTS_PER_MESSAGE,
  ASSET_ROOM_PARTS,
  ASSET_ROOM_SUBSCRIBE_PARTS,
  type AssetPartsRequest,
  type AssetRoomPartsMessage
} from "@jolly-pixel/asset-server/client";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { chunkPartId } from "./chunkParts.ts";
import type {
  ChunkSnapshot,
  TerrainManifest,
  TerrainNetworkCommand,
  TerrainServerMessage
} from "./types.ts";

type SnapshotMessage = Extract<TerrainServerMessage, { type: "snapshot"; }>;

interface PendingSnapshot {
  readonly message: SnapshotMessage;
  readonly manifest: TerrainManifest;
  readonly heights: Map<string, string>;
  readonly waiting: Set<string>;
  readonly held: TerrainServerMessage[];
}

export class TerrainPartsRoom implements Room<
  TerrainNetworkCommand,
  TerrainServerMessage
> {
  #room: Room<TerrainNetworkCommand, unknown>;
  #listeners = new Set<(message: TerrainServerMessage) => void>();
  #subscribed = new Set<string>();
  #clientId: string | null;
  #pending: PendingSnapshot | null = null;

  #onMessage = (
    message: unknown
  ): void => {
    if (isPartsMessage(message)) {
      this.#receiveParts(message);
    }
    else if (isSnapshotMessage(message)) {
      this.#receiveSnapshot(message);
    }
    else if (this.#pending === null) {
      this.#deliver(message as TerrainServerMessage);
    }
    else {
      this.#pending.held.push(message as TerrainServerMessage);
    }
  };

  #onSync = (): void => {
    if (this.#room.clientId !== this.#clientId) {
      this.#clientId = this.#room.clientId;
      this.#subscribed.clear();
    }
  };

  constructor(
    room: Room<TerrainNetworkCommand, unknown>
  ) {
    this.#room = room;
    this.#clientId = room.clientId;
    room.on("sync", this.#onSync);
  }

  get id(): string {
    return this.#room.id;
  }

  get clientId(): string | null {
    return this.#room.clientId;
  }

  get peers(): ReadonlyMap<string, Peer> {
    return this.#room.peers;
  }

  get profile(): PeerMetadata {
    return this.#room.profile;
  }

  get role(): string {
    return this.#room.role;
  }

  get rights(): RoomRights {
    return this.#room.rights;
  }

  get access(): Right {
    return this.#room.access;
  }

  can(
    event: string
  ): Right {
    return this.#room.can(event);
  }

  join(): void {
    this.#room.join();
  }

  send(
    payload: TerrainNetworkCommand
  ): void {
    this.#room.send(payload);
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    this.#room.updatePresence(patch);
  }

  resync(): void {
    this.#room.resync();
  }

  resumeWith(
    source: (() => unknown) | null
  ): void {
    this.#room.resumeWith(source);
  }

  leave(): void {
    this.#room.leave();
  }

  on<K extends keyof RoomEventMap<TerrainServerMessage>>(
    type: K,
    listener: RoomEventMap<TerrainServerMessage>[K]
  ): void {
    if (type !== "message") {
      this.#room.on(type, listener as RoomEventMap<unknown>[K]);

      return;
    }

    if (this.#listeners.size === 0) {
      this.#room.on("message", this.#onMessage);
    }
    this.#listeners.add(listener as (message: TerrainServerMessage) => void);
  }

  off<K extends keyof RoomEventMap<TerrainServerMessage>>(
    type: K,
    listener: RoomEventMap<TerrainServerMessage>[K]
  ): void {
    if (type !== "message") {
      this.#room.off(type, listener as RoomEventMap<unknown>[K]);

      return;
    }

    this.#listeners.delete(listener as (message: TerrainServerMessage) => void);
    if (this.#listeners.size === 0) {
      this.#room.off("message", this.#onMessage);
      this.#room.off("sync", this.#onSync);
      this.#pending = null;
    }
  }

  #receiveSnapshot(
    message: SnapshotMessage
  ): void {
    const manifest = message.data as TerrainManifest;
    const heights = new Map<string, string>();
    const waiting = new Set<string>();
    for (const chunk of manifest.chunks) {
      const partId = chunkPartId(new ChunkCoord(chunk.x, chunk.z));
      if (chunk.heights === undefined) {
        waiting.add(partId);
      }
      else {
        heights.set(partId, chunk.heights);
      }
    }
    this.#pending = {
      message,
      manifest,
      heights,
      waiting,
      held: []
    };

    this.#subscribe([...waiting].filter((partId) => !this.#subscribed.has(partId)));
    this.#settle();
  }

  #receiveParts(
    message: AssetRoomPartsMessage
  ): void {
    const pending = this.#pending;
    if (pending === null) {
      return;
    }

    for (const [partId, heights] of Object.entries(message.parts)) {
      if (pending.waiting.delete(partId) && typeof heights === "string") {
        pending.heights.set(partId, heights);
      }
    }
    this.#settle();
  }

  #subscribe(
    partIds: readonly string[]
  ): void {
    for (const partId of partIds) {
      this.#subscribed.add(partId);
    }
    for (let index = 0; index < partIds.length; index += ASSET_ROOM_MAX_PARTS_PER_MESSAGE) {
      const request: AssetPartsRequest = {
        action: ASSET_ROOM_SUBSCRIBE_PARTS,
        parts: partIds.slice(index, index + ASSET_ROOM_MAX_PARTS_PER_MESSAGE)
      };
      this.#room.send(request as unknown as TerrainNetworkCommand);
    }
  }

  #settle(): void {
    const pending = this.#pending;
    if (pending === null || pending.waiting.size > 0) {
      return;
    }

    this.#pending = null;
    const chunks: ChunkSnapshot[] = [];
    for (const { x, z } of pending.manifest.chunks) {
      const heights = pending.heights.get(chunkPartId(new ChunkCoord(x, z)));
      if (heights !== undefined) {
        chunks.push({ x, z, heights });
      }
    }
    this.#deliver({
      ...pending.message,
      data: { chunks }
    });
    for (const message of pending.held) {
      this.#deliver(message);
    }
  }

  #deliver(
    message: TerrainServerMessage
  ): void {
    for (const listener of [...this.#listeners]) {
      listener(message);
    }
  }
}

function isPartsMessage(
  message: unknown
): message is AssetRoomPartsMessage {
  return typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === ASSET_ROOM_PARTS;
}

function isSnapshotMessage(
  message: unknown
): message is SnapshotMessage {
  return typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === "snapshot";
}
