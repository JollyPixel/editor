// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { ServerRoom } from "./ServerRoom.ts";
import { errorMessage } from "../errors.ts";
import type { Logger } from "../logger.ts";
import type { RightsTable } from "../rights/RightsTable.ts";
import type { Extension } from "../extension/Extension.ts";
import type {
  RoomResolution,
  RoomResolver
} from "./RoomResolver.ts";
import {
  systemTimers,
  type TimerHandle,
  type Timers
} from "./timers.ts";

// CONSTANTS
const kDefaultRoomGraceMs = 30_000;

/**
 * Static entries have no resolution and are never evicted.
 */
interface RoomEntry {
  name: string;
  room: ServerRoom;
  resolution: RoomResolution | null;
  evictionHandle: TimerHandle | null;
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
  /**
   * Clock behind eviction. Injected so a caller can drive the grace period
   * instead of waiting on it.
   */
  timers?: Timers;
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
  #timers: Timers;
  #entries = new Map<string, RoomEntry>();
  /**
   * In-flight teardowns that replacement rooms must await.
   */
  #evictions = new Map<string, Promise<void>>();

  constructor(
    options: RoomRegistryOptions
  ) {
    this.#logger = options.logger;
    this.#rights = options.rights;
    this.#eventStore = options.eventStore;
    this.#resolver = options.resolver ?? null;
    this.#graceMs = options.graceMs ?? kDefaultRoomGraceMs;
    this.#timers = options.timers ?? systemTimers;
  }

  setResolver(
    resolver: RoomResolver | null
  ): void {
    this.#resolver = resolver;
  }

  register(
    extension: Extension
  ): void {
    this.#add(extension.id, extension, null);
    this.#logger
      .withMetadata({ room: extension.id })
      .info("room registered");
  }

  /**
   * Creates an unknown room only when `options.create` is true.
   */
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

    // Wait for prior teardown so the replacement sees flushed state.
    await this.#evictions.get(name);

    const resolution = await this.#resolveOnce(name);
    if (resolution === null) {
      return null;
    }

    // Reuse a room resolved while this call awaited the resolver.
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

  /**
   * Removes a member, then updates the room's eviction timer.
   */
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

  /**
   * Arms eviction only for empty, dynamically resolved rooms.
   */
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

    entry.evictionHandle = this.#timers.setTimeout(
      () => void this.#evict(entry),
      entry.resolution.graceMs ?? this.#graceMs
    );
  }

  /**
   * Resolves once in-flight evictions have finished, for one room or all
   * of them.
   *
   * Eviction starts on a timer and tears down asynchronously, so a caller
   * that needs to observe the flushed state of an evicted room awaits this
   * instead of racing the teardown.
   */
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
    extension: Extension,
    resolution: RoomResolution | null
  ): RoomEntry {
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

    this.#timers.clearTimeout(entry.evictionHandle);
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

    // Publish teardown first so replacement resolution waits for the flush.
    const teardown = this.#teardown(entry)
      .finally(() => this.#evictions.delete(entry.name));
    this.#evictions.set(entry.name, teardown);

    await teardown;
  }

  async #teardown(
    entry: RoomEntry
  ): Promise<void> {
    try {
      // Flush persisted state before releasing the extension.
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
