// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type { LocalEdits } from "@jolly-pixel/history";
import type {
  EditableDocumentKind,
  Peer,
  PeerMetadata,
  Room,
  RoomRejectionEvent,
  SyncedDocument
} from "@jolly-pixel/network/client";
import type { ProjectManifest } from "@jolly-pixel/server";
import type * as z from "zod/mini";

// Import Internal Dependencies
import type {
  GolemAssets,
  GolemKind
} from "./kinds.ts";
import { SentCommands } from "./SentCommands.ts";
import { AssetClosedError } from "./errors/AssetClosedError.ts";
import { CommandDeniedError } from "./errors/CommandDeniedError.ts";
import { CommandInvalidError } from "./errors/CommandInvalidError.ts";

// CONSTANTS
export const MAX_BATCH_COMMANDS = 500;
export const MAX_UNANSWERED_COMMANDS = 1_000;

export interface GolemCommand {
  action: string;
}

export type GolemDocumentKind<
  TCommand,
  TSynced extends SyncedDocument<unknown>
> = EditableDocumentKind<string, Room, TSynced, TCommand>;

export type CatalogReader = Pick<
  CatalogClient,
  "record" | "records" | "dependencies"
>;

export type StudioManifest = Pick<ProjectManifest, "sceneComponents">;

export interface AssetOpening {
  assetId: string;
  room: Room;
  catalog: CatalogReader;
  /**
   * What the studio serves in `project-manifest.json`.
   */
  manifest: StudioManifest;
  /**
   * Aborting it fails the asset with its reason.
   */
  signal: AbortSignal;
  onClose: () => void;
  /**
   * Opens another asset through the same golem, for kinds that need one.
   */
  open: <TKind extends GolemKind>(
    assetId: string,
    kind: TKind
  ) => Promise<GolemAssets[TKind]>;
}

export abstract class GolemAsset<
  TCommand extends GolemCommand = GolemCommand,
  TSynced extends SyncedDocument<unknown> = SyncedDocument<unknown>
> {
  readonly id: string;
  readonly kind: string;

  protected readonly synced: TSynced;

  #room: Room;
  #schema: z.ZodMiniType<TCommand>;
  #actions: ReadonlySet<string>;
  #edits: LocalEdits<TCommand>;
  #sent = new SentCommands<TCommand>();
  #ready = Promise.withResolvers<void>();
  #release: () => void;
  #onClose: () => void;
  #closed = false;

  #onDenied = (
    event: RoomRejectionEvent
  ): void => {
    if (this.#actions.has(event.event)) {
      this.#fail(new CommandDeniedError(event.event, event.reason));
    }
  };

  constructor(
    opening: AssetOpening,
    kind: GolemDocumentKind<TCommand, TSynced>
  ) {
    const { signal } = opening;
    this.id = opening.assetId;
    this.kind = kind.kind;
    this.synced = kind.syncDocument(opening.room);
    this.#room = opening.room;
    this.#schema = kind.commandSchema;
    this.#actions = new Set(kind.commandProtocol.events);
    this.#edits = kind.localEdits(this.synced);
    this.#onClose = opening.onClose;
    this.synced.ready
      .then(() => this.loaded())
      .then(this.#ready.resolve, this.#ready.reject);

    const { receipts } = this.#edits;
    const onAbort = (): void => this.#fail(signal.reason);
    const unsubscribers = [
      receipts.subscribe("confirmed", (change) => this.#sent.confirm(change)),
      receipts.subscribe("refused", (change) => this.#sent.refuse(change))
    ];
    this.#room.on("denied", this.#onDenied);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
    this.#release = () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      this.#room.off("denied", this.#onDenied);
      signal.removeEventListener("abort", onAbort);
    };
    this.#room.join();
  }

  get ready(): Promise<void> {
    return this.#ready.promise;
  }

  get unanswered(): number {
    return this.#sent.unanswered;
  }

  get closed(): boolean {
    return this.#closed;
  }

  peers(): IterableIterator<Peer> {
    return this.#room.peers.values();
  }

  abstract read(): unknown;

  protected abstract focus(
    commands: readonly TCommand[]
  ): PeerMetadata | null;

  async apply(
    commands: Iterable<unknown>
  ): Promise<void> {
    this.#throwIfFailed();
    const batch = this.#parse(commands);
    this.guard(batch);
    while (
      this.#sent.unanswered > 0 &&
      this.#sent.unanswered + batch.length > MAX_UNANSWERED_COMMANDS
    ) {
      await this.#sent.drained();
    }
    this.#throwIfFailed();

    for (const [index, command] of batch.entries()) {
      const change = this.#edits.applyStep(command);
      if (change === null) {
        throw new CommandInvalidError(
          index,
          `the asset cannot apply ${JSON.stringify(command)} as it is now`
        );
      }
      this.#sent.track(change, command);
    }

    const focus = this.focus(batch);
    if (focus !== null) {
      this.#room.updatePresence(focus);
    }
  }

  settled(): Promise<void> {
    return this.#sent.settled();
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#fail(new AssetClosedError(this.id));
    this.#release();
    this.synced.dispose();
    this.#room.leave();
    this.#onClose();
  }

  protected guard(
    _commands: readonly TCommand[]
  ): void {
    return;
  }

  protected loaded(): Promise<void> | void {
    return;
  }

  protected async applyInBatches(
    commands: readonly TCommand[]
  ): Promise<void> {
    for (let start = 0; start < commands.length; start += MAX_BATCH_COMMANDS) {
      await this.apply(commands.slice(start, start + MAX_BATCH_COMMANDS));
    }
  }

  #fail(
    error: Error
  ): void {
    this.#sent.fail(error);
    this.#ready.reject(error);
  }

  #parse(
    commands: Iterable<unknown>
  ): TCommand[] {
    const batch = [...commands];
    if (batch.length > MAX_BATCH_COMMANDS) {
      throw new RangeError(
        `A batch holds at most ${MAX_BATCH_COMMANDS} commands, got ${batch.length}.`
      );
    }

    return batch.map((command, index) => {
      const parsed = this.#schema.safeParse(command);
      if (!parsed.success) {
        throw new CommandInvalidError(index, parsed.error.message);
      }
      const { action } = parsed.data;
      if (this.#room.can(action) !== "write") {
        throw new CommandDeniedError(
          action,
          `role "${this.#room.role}" may only read this asset`
        );
      }

      return parsed.data;
    });
  }

  #throwIfFailed(): void {
    if (this.#sent.failure !== null) {
      throw this.#sent.failure;
    }
  }
}
