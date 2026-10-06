// Import Internal Dependencies
import type { Room } from "../Room.ts";
import type { CommandReconciler } from "./CommandReconciler.ts";
import {
  CommandSync,
  type CommandBody
} from "./CommandSync.ts";
import type { CommandChange } from "./CommandDocument.ts";
import type { ChangeReceipts } from "../history/ChangeReceipts.ts";
import type { ConflictResolver } from "../../sync/ConflictResolver.ts";
import type {
  NetworkCommandHeader,
  NetworkServerMessage,
  NetworkServerNoticeOf
} from "../../sync/types.ts";

type SyncedChange<
  TCommand extends NetworkCommandHeader,
  TImage
> = CommandChange<CommandBody<TCommand>, TImage>;

export interface SyncableDocument<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TImage
> {
  readonly receipts: ChangeReceipts<SyncedChange<TCommand, TImage>>;
  subscribe(event: "change", listener: (change: SyncedChange<TCommand, TImage>) => void): () => void;
  load(snapshot: TSnapshot): void;
  apply(command: TCommand, clientId: string | null): boolean;
  replayPending(command: TCommand): SyncedChange<TCommand, TImage> | null;
  revert(images: readonly TImage[]): void;
}

export interface DocumentSyncClientOptions<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TImage
> {
  document: SyncableDocument<TCommand, TSnapshot, TImage>;
  /** The registers an absolute write sets; `null` for any other command. */
  keys(command: TCommand): readonly string[] | null;
  resolver?: ConflictResolver<TCommand>;
}

export class DocumentSyncClient<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TNotice extends NetworkServerNoticeOf<TNotice>,
  TImage
> extends CommandSync<TCommand, TSnapshot, TNotice> {
  #release: Array<() => void>;

  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>,
    options: DocumentSyncClientOptions<NoInfer<TCommand>, NoInfer<TSnapshot>, TImage>
  ) {
    const { document, keys, resolver } = options;
    const reconciler = new DocumentReconciler(document, keys);
    super(room, { reconciler, resolver });

    this.on("acknowledged", (command, version) => {
      const change = reconciler.changeOf(command);
      if (change !== undefined && version !== undefined) {
        document.receipts.confirm(change, version);
      }
    });
    this.on("refused", (command) => {
      const change = reconciler.changeOf(command);
      if (change !== undefined) {
        document.receipts.refuse(change);
      }
    });
    this.on("snapshot", (snapshot) => document.load(snapshot));
    this.on("command", (command) => document.apply(command, command.clientId));
    this.#release = [
      document.receipts.attach(),
      document.subscribe("change", (change) => {
        if (change.origin === "local") {
          reconciler.capture(this.send(change.command, Date.now(), change.basis), change);
        }
      })
    ];
  }

  override destroy(): void {
    for (const release of this.#release.splice(0)) {
      release();
    }
    super.destroy();
  }
}

interface PendingChange<
  TCommand extends NetworkCommandHeader,
  TImage
> {
  readonly change: SyncedChange<TCommand, TImage>;
  image: TImage | null;
}

class DocumentReconciler<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TImage
> implements CommandReconciler<TCommand> {
  #document: SyncableDocument<TCommand, TSnapshot, TImage>;
  #keys: (command: TCommand) => readonly string[] | null;
  #pending = new WeakMap<TCommand, PendingChange<TCommand, TImage>>();

  constructor(
    document: SyncableDocument<TCommand, TSnapshot, TImage>,
    keys: (command: TCommand) => readonly string[] | null
  ) {
    this.#document = document;
    this.#keys = keys;
  }

  keys(
    command: TCommand
  ): readonly string[] | null {
    return this.#keys(command);
  }

  narrow(): TCommand | null {
    return null;
  }

  capture(
    sent: TCommand,
    change: SyncedChange<TCommand, TImage>
  ): void {
    this.#pending.set(sent, { change, image: change.image });
  }

  changeOf(
    command: TCommand
  ): SyncedChange<TCommand, TImage> | undefined {
    return this.#pending.get(command)?.change;
  }

  revert(
    pending: readonly TCommand[]
  ): boolean {
    const images: TImage[] = [];
    for (const command of pending) {
      const image = this.#pending.get(command)?.image ?? null;
      if (image === null) {
        return false;
      }
      images.push(image);
    }
    this.#document.revert(images);

    return true;
  }

  replay(
    command: TCommand
  ): boolean {
    const replayed = this.#document.replayPending(command);
    const pending = this.#pending.get(command);
    if (pending !== undefined) {
      pending.image = replayed?.image ?? null;
    }

    return replayed !== null;
  }
}
