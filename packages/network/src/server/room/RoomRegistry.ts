// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { ServerRoom } from "./ServerRoom.ts";
import {
  errorMessage,
  UngatedExtensionError
} from "../errors.ts";
import type { Logger } from "../logger.ts";
import type { RightsTable } from "../rights/RightsTable.ts";
import type { AnyExtension } from "../extension/Extension.ts";
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
  evictionHandle: NodeJS.Timeout | null;
}

export interface RoomRegistryOptions {
  logger: Logger;
  rights: RightsTable;
  eventStore: EventStore.EventStore;
  resolver?: RoomResolver | null;
  /**
   * Empty resolved-room grace period in milliseconds.
   * @default 30_000
   */
  graceMs?: number;
}

/**
 * Owns room resolution and eviction; membership comes from `room.size`.
 */
export class RoomRegistry {
  #logger: Logger;
  #rights: RightsTable;
  #eventStore: EventStore.EventStore;
  #resolver: RoomResolver | null;
  #graceMs: number;
  #entries = new Map<string, RoomEntry>();
  #evictions = new Map<string, Promise<void>>();

  constructor(
    options: RoomRegistryOptions
  ) {
    this.#logger = options.logger;
    this.#rights = options.rights;
    this.#eventStore = options.eventStore;
    this.#resolver = options.resolver ?? null;
    this.#graceMs = options.graceMs ?? kDefaultRoomGraceMs;
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

  async resolve(
    name: string,
    options: { create: boolean; }
  ): Promise<ServerRoom | null> {
    const existing = this.#entries.get(name);
    if (existing !== undefined) {
      return existing.room;
    }
    if (!options.create) {
      return null;
    }

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

  async leave(
    name: string,
    clientId: string
  ): Promise<void> {
    const entry = this.#entries.get(name);
    if (entry === undefined) {
      return;
    }

    try {
      await entry.room.leave(clientId);
    }
    finally {
      this.syncEviction(name);
    }
  }

  syncEviction(
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
    entry.evictionHandle.unref();
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
          eventStore: this.#eventStore
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
