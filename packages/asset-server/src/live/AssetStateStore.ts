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
import {
  foldAssetEvent,
  heldPartRefs,
  loadHeldParts,
  type AssetHeldPartRefs,
  type AssetHeldParts
} from "../model/kinds/foldAssetEvent.ts";
import { InvalidAssetFileError } from "../model/kinds/errors/InvalidAssetFileError.ts";
import {
  silentLogger,
  type Logger
} from "../common/logger.ts";
import { asError } from "../common/asError.ts";
import { TaskChain } from "../common/TaskChain.ts";
import { yieldToEventLoop } from "../common/yieldToEventLoop.ts";

// CONSTANTS
const kReplayYieldEvery = 250;
const kCheckpointEventTypes = new Set<string>(ASSET_CHECKPOINT_EVENT_TYPES);
const kContentEventTypes = new Set<string>([ASSET_CREATED, ASSET_UPDATED]);
const kNoHeldPartRefs: AssetHeldPartRefs = new Map();
const kNoHeldParts: AssetHeldParts = new Map();

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
  readonly folds: TaskChain;
}

interface Replay {
  readonly entry: Promise<AssetStateEntry>;
  readonly arrived: EventStore.Event[];
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
  #replays = new Map<string, Replay>();
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
      if (open === undefined) {
        this.#replays.get(event.assetId)?.arrived.push(event);
      }
      else {
        this.#receive(open, event);
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
      return inFlight.entry;
    }

    const arrived: EventStore.Event[] = [];
    const entry = this.#replay(assetId, kind, arrived)
      .then((open) => open.entry)
      .finally(() => this.#replays.delete(assetId));
    this.#replays.set(assetId, {
      entry,
      arrived
    });

    return entry;
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
    kind: string,
    arrived: readonly EventStore.Event[]
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
      touchedParts: new Set(),
      folds: new TaskChain()
    };
    const events = await this.#eventStore.reader.listFromCheckpoints({
      assetId,
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES
    });
    let sinceYield = 0;
    for (const event of events) {
      this.#receive(open, event);
      if (++sinceYield >= kReplayYieldEvery) {
        sinceYield = 0;
        await yieldToEventLoop();
      }
    }
    await open.folds.settled();

    this.#open.set(assetId, open);
    for (const event of arrived) {
      if (event.eventVersion > open.version) {
        this.#receive(open, event);
      }
    }

    return open;
  }

  #receive(
    open: OpenAsset,
    event: EventStore.Event
  ): void {
    const refs = skipsFold(open, event) ? kNoHeldPartRefs : heldPartRefs(event);
    if (open.folds.idle && refs.size === 0) {
      this.#apply(open, event, this.#fold(open, event, kNoHeldParts));

      return;
    }

    void open.folds.run(async() => {
      this.#apply(open, event, await this.#foldHeld(open, event, refs));
    });
  }

  #apply(
    open: OpenAsset,
    event: EventStore.Event,
    command: AssetCommandHeader | null
  ): void {
    this.#follow(open, event, command);
    if (replacesContent(event) && this.#open.get(event.assetId) === open) {
      this.emit("replaced", event.assetId);
    }
  }

  async #foldHeld(
    open: OpenAsset,
    event: EventStore.Event,
    refs: AssetHeldPartRefs
  ): Promise<AssetCommandHeader | null> {
    let held: AssetHeldParts;
    try {
      held = await loadHeldParts(event.assetId, refs, this.#eventStore.reader);
    }
    catch (error) {
      this.#notFolded(event, error);

      return null;
    }

    return this.#fold(open, event, held);
  }

  #follow(
    open: OpenAsset,
    event: EventStore.Event,
    command: AssetCommandHeader | null
  ): void {
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
    open: OpenAsset,
    event: EventStore.Event,
    held: AssetHeldParts
  ): AssetCommandHeader | null {
    if (skipsFold(open, event)) {
      return null;
    }

    try {
      return foldAssetEvent(
        open.entry.handler,
        open.entry.state,
        event,
        held
      );
    }
    catch (error) {
      this.#notFolded(event, error);

      return null;
    }
  }

  #notFolded(
    event: EventStore.Event,
    error: unknown
  ): void {
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
  }
}

function skipsFold(
  open: OpenAsset,
  event: EventStore.Event
): boolean {
  return open.version > 0 && isStateNeutral(event);
}

function replacesContent(
  event: EventStore.Event
): boolean {
  return kContentEventTypes.has(event.eventType) &&
    !isStateNeutral(event);
}
