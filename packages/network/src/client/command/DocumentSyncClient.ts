// Import Third-party Dependencies
import type {
  ChangeReceipts,
  CommandChange
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { Room } from "../Room.ts";
import type { CommandReconciler } from "./CommandReconciler.ts";
import {
  CommandSync,
  type CommandBody
} from "./CommandSync.ts";
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
  /**
   * The registers an absolute write sets; `null` for any other command.
   */
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
    super(room, {
      reconciler,
      resolver,
      receipts: document.receipts
    });

    this.on("snapshot", (snapshot) => document.load(snapshot));
    this.on("command", (command) => document.apply(command, command.clientId));
    this.#release = [
      document.subscribe("change", (change) => {
        if (change.origin === "local") {
          reconciler.capture(this.sendChange(change.command, change), change);
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

class DocumentReconciler<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TImage
> implements CommandReconciler<TCommand> {
  #document: SyncableDocument<TCommand, TSnapshot, TImage>;
  #keys: (command: TCommand) => readonly string[] | null;
  #images = new WeakMap<TCommand, TImage | null>();

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
    this.#images.set(sent, change.image);
  }

  revert(
    pending: readonly TCommand[]
  ): boolean {
    const images: TImage[] = [];
    for (const command of pending) {
      const image = this.#images.get(command) ?? null;
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
    if (this.#images.has(command)) {
      this.#images.set(command, replayed?.image ?? null);
    }

    return replayed !== null;
  }
}
