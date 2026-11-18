// Import Third-party Dependencies
import type { LocalEdits } from "@jolly-pixel/history";
import type {
  EditableDocumentKind,
  Peer,
  PeerMetadata,
  Room,
  RoomRejectionEvent,
  SyncedDocument
} from "@jolly-pixel/network/client";
import type * as z from "zod/mini";

// Import Internal Dependencies
import type {
  AssetOpening,
  AssetStudio
} from "./AssetOpening.ts";
import {
  CommandBatch,
  MAX_BATCH_COMMANDS,
  type GolemCommand
} from "./CommandBatch.ts";
import { SentCommands } from "./SentCommands.ts";
import { AssetClosedError } from "./errors/AssetClosedError.ts";
import { CommandDeniedError } from "./errors/CommandDeniedError.ts";
import { CommandInvalidError } from "./errors/CommandInvalidError.ts";

export type GolemDocumentKind<
  TCommand,
  TSynced extends SyncedDocument<unknown>
> = EditableDocumentKind<string, Room, TSynced, TCommand>;

export abstract class GolemAsset<
  TCommand extends GolemCommand = GolemCommand,
  TSynced extends SyncedDocument<unknown> = SyncedDocument<unknown>
> {
  readonly id: string;
  readonly kind: string;

  protected readonly synced: TSynced;
  protected readonly studio: AssetStudio;

  #room: Room;
  #schema: z.ZodMiniType<TCommand>;
  #edits: LocalEdits<TCommand>;
  #sent = new SentCommands<TCommand>();
  #ready = Promise.withResolvers<void>();
  #subscriptions = new DisposableStack();
  #onClose: () => void;

  constructor(
    opening: AssetOpening,
    kind: GolemDocumentKind<TCommand, TSynced>
  ) {
    const { signal } = opening;
    this.id = opening.assetId;
    this.kind = kind.kind;
    this.synced = kind.syncDocument(opening.room);
    this.studio = opening.studio;
    this.#room = opening.room;
    this.#schema = kind.commandSchema;
    this.#edits = kind.localEdits(this.synced);
    this.#onClose = opening.onClose;
    this.synced.ready
      .then(() => this.loaded())
      .then(this.#ready.resolve, this.#ready.reject);

    const actions = new Set(kind.commandProtocol.events);
    const onDenied = (event: RoomRejectionEvent): void => {
      if (actions.has(event.event)) {
        this.#fail(new CommandDeniedError(event.event, event.reason));
      }
    };
    const onAbort = (): void => this.#fail(signal.reason);
    const { receipts } = this.#edits;
    this.#subscriptions.defer(
      receipts.subscribe("confirmed", (change) => this.#sent.confirm(change))
    );
    this.#subscriptions.defer(
      receipts.subscribe("refused", (change) => this.#sent.refuse(change))
    );
    this.#room.on("denied", onDenied);
    this.#subscriptions.defer(() => this.#room.off("denied", onDenied));
    signal.addEventListener("abort", onAbort, { once: true });
    this.#subscriptions.defer(
      () => signal.removeEventListener("abort", onAbort)
    );
    if (signal.aborted) {
      onAbort();
    }
    this.#room.join();
  }

  get ready(): Promise<void> {
    return this.#ready.promise;
  }

  get unanswered(): number {
    return this.#sent.unanswered;
  }

  get closed(): boolean {
    return this.#subscriptions.disposed;
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
    const { commands: batch } = new CommandBatch(commands, this.#schema);
    await this.#sent.makeRoom(batch.length);
    this.#assertWritable(batch);
    this.guard(batch);

    for (const [index, command] of batch.entries()) {
      const change = this.#edits.applyStep(command);
      if (change === null) {
        throw new CommandInvalidError(
          index,
          `the asset cannot apply ${JSON.stringify(command)} as it is now` +
          (index > 0 ? `; the ${index} command(s) before it were sent` : "")
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
    if (this.closed) {
      return;
    }

    this.#fail(new AssetClosedError(this.id));
    this.#subscriptions.dispose();
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

  #assertWritable(
    commands: readonly TCommand[]
  ): void {
    for (const { action } of commands) {
      if (this.#room.can(action) !== "write") {
        throw new CommandDeniedError(
          action,
          `role "${this.#room.role}" may only read this asset`
        );
      }
    }
  }
}
