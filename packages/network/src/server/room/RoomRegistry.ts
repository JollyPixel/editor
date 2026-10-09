// Import Internal Dependencies
import {
  ServerRoom,
  type RoomJoiner,
  type RoomLimits
} from "./ServerRoom.ts";
import { errorMessage } from "../errors.ts";
import { UngatedExtensionError } from "../errors/UngatedExtensionError.ts";
import type { Logger } from "../logger.ts";
import type { RightsTable } from "../rights/RightsTable.ts";
import type { AnyExtension } from "../extension/Extension.ts";
import type { PeerMetadata } from "../../protocol/types.ts";
import type {
  RoomResolution,
  RoomResolver
} from "./RoomResolver.ts";

// CONSTANTS
const kDefaultRoomGraceMs = 30_000;

interface RoomEntry {
  name: string;
  room: ServerRoom;
  resolution: RoomResolution | null;
  evictionHandle: ReturnType<typeof setTimeout> | null;
}

export type RoomJoinResult = "joined" | "member" | "denied" | "unregistered";

export interface RoomRegistryOptions {
  logger: Logger;
  rights: RightsTable;
  resolver?: RoomResolver | null;
  /**
   * Empty resolved-room grace period in milliseconds.
   * @default 30_000
   */
  graceMs?: number;
  limits?: RoomLimits;
}

/**
 * Owns room resolution and eviction; membership lives in each room.
 */
export class RoomRegistry {
  #logger: Logger;
  #rights: RightsTable;
  #resolver: RoomResolver | null;
  #graceMs: number;
  #limits: RoomLimits | undefined;
  #entries = new Map<string, RoomEntry>();
  #evictions = new Map<string, Promise<void>>();
  #resolutions = new Map<string, Promise<ServerRoom | null>>();

  constructor(
    options: RoomRegistryOptions
  ) {
    this.#logger = options.logger;
    this.#rights = options.rights;
    this.#resolver = options.resolver ?? null;
    this.#graceMs = options.graceMs ?? kDefaultRoomGraceMs;
    this.#limits = options.limits;
  }

  setResolver(
    resolver: RoomResolver | null
  ): void {
    this.#resolver = resolver;
  }

  register(
    extension: AnyExtension
  ): void {
    this.#add(extension.id, extension, null);
    this.#logger
      .withMetadata({ room: extension.id })
      .info("room registered");
  }

  get(
    name: string
  ): ServerRoom | undefined {
    return this.#entries.get(name)?.room;
  }

  async join(
    name: string,
    joiner: RoomJoiner
  ): Promise<RoomJoinResult> {
    const room = await this.#resolve(name);
    if (room === null) {
      return "unregistered";
    }
    if (room.has(joiner.handle.id)) {
      return "member";
    }

    try {
      return await room.join(joiner) ? "joined" : "denied";
    }
    finally {
      this.#syncEviction(name);
    }
  }

  async leave(
    name: string,
    clientId: string
  ): Promise<boolean> {
    const room = this.get(name);
    if (room === undefined) {
      return false;
    }

    try {
      return await room.leave(clientId);
    }
    finally {
      this.#syncEviction(name);
    }
  }

  async leaveAll(
    clientId: string
  ): Promise<string[]> {
    const names = [...this.#entries.values()]
      .filter((entry) => entry.room.has(clientId))
      .map((entry) => entry.name);
    for (const name of names) {
      try {
        await this.leave(name, clientId);
      }
      catch (error) {
        this.#logger
          .withMetadata({
            clientId,
            room: name,
            reason: errorMessage(error)
          })
          .error("disconnect handling failed");
      }
    }

    return names;
  }

  updateProfile(
    clientId: string,
    patch: PeerMetadata
  ): void {
    for (const { room } of this.#entries.values()) {
      room.updateProfile(clientId, patch);
    }
  }

  async #resolve(
    name: string
  ): Promise<ServerRoom | null> {
    const existing = this.#entries.get(name);
    if (existing !== undefined) {
      return existing.room;
    }

    const pending = this.#resolutions.get(name);
    if (pending !== undefined) {
      return pending;
    }

    const resolution = this.#create(name).finally(() => {
      this.#resolutions.delete(name);
    });
    this.#resolutions.set(name, resolution);

    return resolution;
  }

  async #create(
    name: string
  ): Promise<ServerRoom | null> {
    await this.#evictions.get(name);

    const resolution = await this.#resolveOnce(name);
    if (resolution === null) {
      return null;
    }

    const raced = this.#entries.get(name);
    if (raced !== undefined) {
      return raced.room;
    }

    const entry = this.#add(name, resolution.extension, resolution);
    this.#logger
      .withMetadata({ room: name })
      .info("room resolved");

    return entry.room;
  }

  #syncEviction(
    name: string
  ): void {
    const entry = this.#entries.get(name);
    if (
      entry === undefined ||
      entry.resolution === null
    ) {
      return;
    }

    if (entry.room.size > 0) {
      this.#disarm(entry);

      return;
    }
    if (entry.evictionHandle !== null) {
      return;
    }

    entry.evictionHandle = setTimeout(
      () => void this.#evict(entry),
      entry.resolution.graceMs ?? this.#graceMs
    );
    entry.evictionHandle.unref?.();
  }

  async settled(
    name?: string
  ): Promise<void> {
    if (name === undefined) {
      await Promise.allSettled(this.#evictions.values());

      return;
    }

    await this.#evictions.get(name);
  }

  async close(): Promise<void> {
    const entries = [
      ...this.#entries.values()
    ];
    this.#entries.clear();

    for (const entry of entries) {
      this.#disarm(entry);
    }

    await Promise.allSettled(
      entries.map((entry) => this.#teardown(entry))
    );
    await Promise.allSettled(
      this.#evictions.values()
    );
  }

  #add(
    name: string,
    extension: AnyExtension,
    resolution: RoomResolution | null
  ): RoomEntry {
    if (
      this.#rights.configured &&
      extension.protocols.inbound === null
    ) {
      throw new UngatedExtensionError(
        `extension "${extension.name}" declares no inbound message protocol, so a rights table cannot gate it`
      );
    }

    const entry: RoomEntry = {
      name,
      room: new ServerRoom(
        name,
        extension,
        this.#rights,
        {
          logger: this.#logger,
          limits: this.#limits
        }
      ),
      resolution,
      evictionHandle: null
    };
    this.#entries.set(name, entry);

    return entry;
  }

  async #resolveOnce(
    name: string
  ): Promise<RoomResolution | null> {
    if (this.#resolver === null) {
      return null;
    }

    try {
      return await this.#resolver(name);
    }
    catch (error) {
      this.#logger
        .withMetadata({ room: name, reason: errorMessage(error) })
        .error("room resolution failed");

      return null;
    }
  }

  #disarm(
    entry: RoomEntry
  ): void {
    if (entry.evictionHandle === null) {
      return;
    }

    clearTimeout(entry.evictionHandle);
    entry.evictionHandle = null;
  }

  async #evict(
    entry: RoomEntry
  ): Promise<void> {
    entry.evictionHandle = null;
    if (
      this.#entries.get(entry.name) !== entry ||
      entry.room.size > 0
    ) {
      return;
    }

    this.#entries.delete(entry.name);

    const teardown = this.#teardown(entry)
      .finally(() => this.#evictions.delete(entry.name));
    this.#evictions.set(entry.name, teardown);

    await teardown;
  }

  async #teardown(
    entry: RoomEntry
  ): Promise<void> {
    try {
      await entry.resolution?.onEvict?.();
    }
    catch (error) {
      this.#logger
        .withMetadata({ room: entry.name, reason: errorMessage(error) })
        .error("room eviction hook failed");
    }

    await entry.room.dispose();
    if (entry.resolution !== null) {
      this.#logger
        .withMetadata({ room: entry.name })
        .info("room evicted");
    }
  }
}
