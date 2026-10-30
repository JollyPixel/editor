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
  ASSET_ROOM_PARTS,
  ASSET_ROOM_SUBSCRIBE_PARTS,
  ASSET_ROOM_UNSUBSCRIBE_PARTS,
  partRequests,
  type AssetPartsRequest,
  type AssetRoomPartsMessage
} from "@jolly-pixel/asset-server/client";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type {
  ChunkContents,
  TerrainStream
} from "../model/TerrainStream.ts";
import {
  chunkPartId,
  chunkPartIds,
  parseChunkPart
} from "./chunkParts.ts";
import { decodeChunkHeights } from "./heights.ts";
import { decodeChunkHoles } from "./holes.ts";
import { decodeSplat } from "./splat.ts";
import type {
  ChunkEntry,
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
  readonly held: (TerrainServerMessage | AssetRoomPartsMessage)[];
}

interface ChunkRead {
  readonly coords: readonly ChunkCoord[];
  readonly waiting: Set<string>;
  readonly parts: Map<string, unknown>;
  readonly resolve: (contents: ChunkContents[]) => void;
  readonly reject: (reason: Error) => void;
}

export class TerrainPartsRoom implements Room<
  TerrainNetworkCommand,
  TerrainServerMessage
> {
  #room: Room<TerrainNetworkCommand, unknown>;
  #stream: TerrainStream;
  #listeners = new Set<(message: TerrainServerMessage) => void>();
  #clientId: string | null;
  #pending: PendingSnapshot | null = null;
  #reads = new Set<ChunkRead>();

  #onMessage = (
    message: unknown
  ): void => {
    if (isPartsMessage(message)) {
      this.#settleReads(message);
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
      const rejoined = this.#clientId !== null;
      this.#clientId = this.#room.clientId;
      if (rejoined) {
        this.#request(ASSET_ROOM_SUBSCRIBE_PARTS, [...this.#stream.subscribed()]);
        for (const { coords } of this.#reads) {
          this.#request(ASSET_ROOM_SUBSCRIBE_PARTS, coords);
        }
      }
    }
  };

  constructor(
    room: Room<TerrainNetworkCommand, unknown>,
    stream: TerrainStream
  ) {
    this.#room = room;
    this.#stream = stream;
    this.#clientId = room.clientId;
    stream.connect({
      subscribe: (coords) => this.#request(ASSET_ROOM_SUBSCRIBE_PARTS, coords),
      unsubscribe: (coords) => this.#request(ASSET_ROOM_UNSUBSCRIBE_PARTS, coords),
      read: (coords) => this.#read(coords)
    });
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
      this.#room.on("sync", this.#onSync);
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
      for (const read of this.#reads) {
        read.reject(new Error("The terrain room closed before its chunks arrived."));
      }
      this.#reads.clear();
    }
  }

  #read(
    coords: readonly ChunkCoord[]
  ): Promise<ChunkContents[]> {
    const { promise, resolve, reject } = Promise.withResolvers<ChunkContents[]>();
    this.#reads.add({
      coords,
      waiting: new Set(coords.flatMap(chunkPartIds)),
      parts: new Map(),
      resolve,
      reject
    });
    this.#request(ASSET_ROOM_SUBSCRIBE_PARTS, coords);

    return promise;
  }

  #settleReads(
    message: AssetRoomPartsMessage
  ): void {
    for (const read of [...this.#reads]) {
      for (const [partId, encoded] of Object.entries(message.parts)) {
        if (read.waiting.delete(partId)) {
          read.parts.set(partId, encoded);
        }
      }
      if (read.waiting.size === 0) {
        this.#reads.delete(read);
        this.#request(
          ASSET_ROOM_UNSUBSCRIBE_PARTS,
          read.coords.filter((coord) => !this.#stream.isSubscribed(coord))
        );
        read.resolve(read.coords.flatMap((coord) => chunkContents(coord, read.parts)));
      }
    }
  }

  #receiveSnapshot(
    message: SnapshotMessage
  ): void {
    const manifest = message.data as TerrainManifest;
    const heights = new Map<string, string>();
    const waiting = new Set<string>();
    for (const chunk of manifest.chunks) {
      const coord = new ChunkCoord(chunk.x, chunk.z);
      const partId = chunkPartId(coord, "heights");
      if (chunk.heights !== undefined) {
        heights.set(partId, chunk.heights);
      }
      else if (this.#stream.isSubscribed(coord)) {
        waiting.add(partId);
      }
    }
    this.#pending = {
      message,
      manifest,
      heights,
      waiting,
      held: []
    };
    this.#settle();
  }

  #receiveParts(
    message: AssetRoomPartsMessage
  ): void {
    const pending = this.#pending;
    if (pending === null) {
      this.#loadParts(message);

      return;
    }

    const late: Record<string, unknown> = {};
    for (const [partId, heights] of Object.entries(message.parts)) {
      if (!pending.waiting.delete(partId)) {
        late[partId] = heights;
      }
      else if (typeof heights === "string") {
        pending.heights.set(partId, heights);
      }
    }
    if (Object.keys(late).length > 0) {
      pending.held.push({ ...message, parts: late });
    }
    this.#settle();
  }

  #loadParts(
    message: AssetRoomPartsMessage
  ): void {
    for (const [partId, encoded] of Object.entries(message.parts)) {
      const part = parseChunkPart(partId);
      if (part === null || typeof encoded !== "string") {
        continue;
      }
      switch (part.channel) {
        case "heights": {
          const heights = decodeChunkHeights(encoded);
          if (heights !== null) {
            this.#stream.received(part.coord, heights);
          }
          break;
        }
        case "splat": {
          const splat = decodeSplat(encoded);
          if (splat !== null) {
            this.#stream.receivedSplat(part.coord, splat);
          }
          break;
        }
        case "holes": {
          const holes = decodeChunkHoles(encoded);
          if (holes !== null) {
            this.#stream.receivedHoles(part.coord, holes);
          }
          break;
        }
      }
    }
  }

  #request(
    action: AssetPartsRequest["action"],
    coords: readonly ChunkCoord[]
  ): void {
    for (const request of partRequests(action, coords.flatMap(chunkPartIds))) {
      this.#room.send(request as unknown as TerrainNetworkCommand);
    }
  }

  #settle(): void {
    const pending = this.#pending;
    if (pending === null || pending.waiting.size > 0) {
      return;
    }

    this.#pending = null;
    const chunks = pending.manifest.chunks.map(({ x, z, overview, materials }): ChunkEntry => {
      const heights = pending.heights.get(chunkPartId(new ChunkCoord(x, z), "heights"));
      const known = materials === undefined ? {} : { materials };

      return heights === undefined ?
        { x, z, ...(overview === undefined ? {} : { overview }), ...known } :
        { x, z, heights, ...known };
    });
    this.#deliver({
      ...pending.message,
      data: { ...pending.manifest, chunks }
    });
    for (const message of pending.held) {
      if (isPartsMessage(message)) {
        this.#loadParts(message);
      }
      else {
        this.#deliver(message);
      }
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

function chunkContents(
  coord: ChunkCoord,
  parts: ReadonlyMap<string, unknown>
): ChunkContents[] {
  const heights = decodedPart(parts.get(chunkPartId(coord, "heights")), decodeChunkHeights);
  const splat = decodedPart(parts.get(chunkPartId(coord, "splat")), decodeSplat);

  return heights === null || splat === null ?
    [] :
    [{
      coord,
      heights,
      splat,
      holes: decodedPart(parts.get(chunkPartId(coord, "holes")), decodeChunkHoles) ?? undefined
    }];
}

function decodedPart<TPart>(
  encoded: unknown,
  decode: (encoded: string) => TPart | null
): TPart | null {
  return typeof encoded === "string" ? decode(encoded) : null;
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
