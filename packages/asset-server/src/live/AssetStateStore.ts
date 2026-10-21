// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../model/kinds/AssetKindRegistry.ts";
import type { AnyAssetKindHandler } from "../model/kinds/AssetKindHandler.ts";
import type { AssetCommandHeader } from "../model/kinds/AssetLiveProtocol.ts";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_CREATED,
  ASSET_UPDATED,
  isStateNeutral
} from "../model/events/AssetEvents.ts";
import { foldAssetEvent } from "../model/kinds/foldAssetEvent.ts";
import { InvalidAssetFileError } from "../model/kinds/errors/InvalidAssetFileError.ts";
import {
  silentLogger,
  type Logger
} from "../common/logger.ts";
import { asError } from "../common/asError.ts";
import { yieldToEventLoop } from "../common/yieldToEventLoop.ts";

// CONSTANTS
const kReplayYieldEvery = 250;
const kCheckpointEventTypes = new Set<string>(ASSET_CHECKPOINT_EVENT_TYPES);
const kContentEventTypes = new Set<string>([ASSET_CREATED, ASSET_UPDATED]);

export type AssetStateStoreEventMap = {
  /**
   * Content loaded outside a scheduled snapshot, such as a disk edit or an archive import.
   */
  replaced: (
    assetId: string
  ) => void;
};

export interface AssetStateEntry {
  readonly assetId: string;
  readonly kind: string;
  readonly handler: AnyAssetKindHandler;
  readonly state: unknown;
}

export interface RecordedCommand<TCommand = unknown> {
  readonly command: TCommand;
  readonly version: number;
}

interface OpenAsset {
  readonly entry: AssetStateEntry;
  version: number;
  commandsSinceCheckpoint: RecordedCommand<AssetCommandHeader>[] | null;
  readonly touchedParts: Set<string>;
}

export interface AssetStateStoreOptions {
  eventStore: EventStore.EventStore;
  kinds: AssetKindRegistry;
  logger?: Logger;
}

export class AssetStateStore extends Emitter<AssetStateStoreEventMap> {
  #eventStore: EventStore.EventStore;
  #kinds: AssetKindRegistry;
  #logger: Logger;
  #open = new Map<string, OpenAsset>();
  #replays = new Map<string, Promise<AssetStateEntry>>();
  #unsubscribe: (() => void) | null = null;

  constructor(
    options: AssetStateStoreOptions
  ) {
    super();
    this.#eventStore = options.eventStore;
    this.#kinds = options.kinds;
    this.#logger = options.logger ?? silentLogger();
  }

  start(): void {
    this.#unsubscribe ??= this.#eventStore.subscribe((event) => {
      const open = this.#open.get(event.assetId);
      if (open !== undefined) {
        this.#follow(open, event);
        if (replacesContent(event)) {
          this.emit("replaced", event.assetId);
        }
      }
    });
  }

  close(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#open.clear();
  }

  has(
    assetId: string
  ): boolean {
    return this.#open.has(assetId);
  }

  get(
    assetId: string
  ): AssetStateEntry | undefined {
    return this.#open.get(assetId)?.entry;
  }

  openVersion(
    assetId: string
  ): number | undefined {
    return this.#open.get(assetId)?.version;
  }

  touchedParts(
    assetId: string
  ): ReadonlySet<string> {
    return new Set(this.#open.get(assetId)?.touchedParts);
  }

  acquire(
    assetId: string,
    kind: string
  ): Promise<AssetStateEntry> {
    const existing = this.#open.get(assetId);
    if (existing !== undefined) {
      return Promise.resolve(existing.entry);
    }

    const inFlight = this.#replays.get(assetId);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const replay = this.#replay(assetId, kind)
      .then((open) => {
        this.#open.set(assetId, open);

        return open.entry;
      })
      .finally(() => this.#replays.delete(assetId));
    this.#replays.set(assetId, replay);

    return replay;
  }

  takeCommandsSinceCheckpoint(
    assetId: string
  ): RecordedCommand<AssetCommandHeader>[] {
    const open = this.#open.get(assetId);
    const commands = open?.commandsSinceCheckpoint ?? [];
    if (open !== undefined) {
      open.commandsSinceCheckpoint = null;
    }

    return commands;
  }

  release(
    assetId: string
  ): void {
    this.#open.delete(assetId);
  }

  async #replay(
    assetId: string,
    kind: string
  ): Promise<OpenAsset> {
    const handler = this.#kinds.get(kind);
    const open: OpenAsset = {
      entry: {
        assetId,
        kind,
        handler,
        state: handler.create(assetId)
      },
      version: 0,
      commandsSinceCheckpoint: [],
      touchedParts: new Set()
    };
    let events = this.#eventStore.reader.listFromCheckpoints({
      assetId,
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES
    });
    let sinceYield = 0;

    while (events.length > 0) {
      for (const event of events) {
        this.#follow(open, event);
        if (++sinceYield >= kReplayYieldEvery) {
          sinceYield = 0;
          await yieldToEventLoop();
        }
      }

      events = this.#eventStore.reader.list(assetId, open.version);
    }

    return open;
  }

  #follow(
    open: OpenAsset,
    event: EventStore.Event
  ): void {
    const command = open.version > 0 && isStateNeutral(event) ?
      null :
      this.#fold(open.entry, event);
    open.version = event.eventVersion;
    if (kCheckpointEventTypes.has(event.eventType)) {
      open.touchedParts.clear();
    }
    else if (command !== null) {
      for (const partId of open.entry.handler.parts?.touched(command) ?? []) {
        open.touchedParts.add(partId);
      }
    }

    const commands = open.commandsSinceCheckpoint;
    if (commands === null) {
      return;
    }
    if (kCheckpointEventTypes.has(event.eventType)) {
      commands.length = 0;
    }
    else if (command !== null) {
      commands.push({
        command,
        version: event.eventVersion
      });
    }
  }

  #fold(
    entry: AssetStateEntry,
    event: EventStore.Event
  ): AssetCommandHeader | null {
    try {
      return foldAssetEvent(
        entry.handler,
        entry.state,
        event,
        this.#eventStore.reader
      );
    }
    catch (error) {
      const log = this.#logger.withMetadata({
        assetId: event.assetId,
        eventId: event.eventId,
        eventType: event.eventType,
        reason: asError(error).message
      });

      if (error instanceof InvalidAssetFileError) {
        log.warn("asset event not folded");
      }
      else {
        log.error("asset event not folded");
      }

      return null;
    }
  }
}

function replacesContent(
  event: EventStore.Event
): boolean {
  return kContentEventTypes.has(event.eventType) &&
    !isStateNeutral(event);
}
