// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { ChangeReceipts } from "@jolly-pixel/history";

// Import Internal Dependencies
import type { Room } from "../Room.ts";
import type { CommandReconciler } from "./CommandReconciler.ts";
import { CommandIntegrator } from "./CommandIntegrator.ts";
import {
  PendingLedger,
  type ChangeOutbox,
  type LedgerEntry,
  type SentChange
} from "./PendingLedger.ts";
import type {
  NetworkAcks,
  NetworkCommandHeader,
  NetworkResume,
  NetworkServerMessage,
  NetworkServerNoticeOf,
  NetworkSyncMessage
} from "../../sync/types.ts";

export type {
  ChangeOutbox,
  SentChange
};

export type CommandBody<TCommand extends NetworkCommandHeader> =
  TCommand extends unknown ?
    Omit<TCommand, keyof NetworkCommandHeader> :
    never;

type SyncMessageType = NetworkSyncMessage<unknown, unknown>["type"];

type SyncMessage<
  TCommand,
  TSnapshot,
  TType extends SyncMessageType
> = Extract<NetworkSyncMessage<TCommand, TSnapshot>, { type: TType; }>;

// CONSTANTS
const kSyncMessageTypes = new Set<string>(Object.keys({
  snapshot: true,
  command: true,
  correction: true,
  "catch-up": true
} satisfies Record<SyncMessageType, true>));

function isSyncMessage<TCommand, TSnapshot>(
  message: { type: string; }
): message is NetworkSyncMessage<TCommand, TSnapshot> {
  return kSyncMessageTypes.has(message.type);
}

export interface CommandSyncOptions<
  TCommand extends NetworkCommandHeader,
  TSnapshot = unknown
> {
  reconciler: CommandReconciler<TCommand>;
  applySnapshot?: (snapshot: TSnapshot) => void | Promise<void>;
  /**
   * Receipts of the local changes sent with "sendChange", attached until "destroy()".
   */
  receipts?: ChangeReceipts<SentChange>;
}

export type PendingChangesEvent = "settled" | "unsettled";

export interface PendingChanges {
  readonly pending: number;

  keepIn(
    outbox: ChangeOutbox
  ): void;
  on(
    event: PendingChangesEvent,
    listener: () => void
  ): unknown;
  off(
    event: PendingChangesEvent,
    listener: () => void
  ): unknown;
}

export type CommandSyncEventMap<
  TCommand,
  TSnapshot,
  TNotice
> = {
  ready: () => void;
  snapshot: (snapshot: TSnapshot) => void;
  "snapshot-failed": (error: unknown) => void;
  command: (command: TCommand) => void;
  notice: (notice: TNotice) => void;
  settled: () => void;
  unsettled: () => void;
  acknowledged: (command: TCommand, version: number | undefined) => void;
  /**
   * Its local effect is already rolled back.
   */
  refused: (command: TCommand) => void;
};

export class CommandSync<
  TCommand extends NetworkCommandHeader,
  TSnapshot,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> extends Emitter<CommandSyncEventMap<TCommand, TSnapshot, TNotice>> {
  readonly room: Room<
    TCommand,
    NetworkServerMessage<TCommand, TSnapshot, TNotice>
  >;

  #seq = 0;
  #version = 0;
  #ready = false;
  #resyncing = false;
  #clientId: string | null = null;
  #resumingFrom: string | null = null;
  #ledger = new PendingLedger<TCommand>();
  #integrator: CommandIntegrator<TCommand>;
  #applySnapshot: ((snapshot: TSnapshot) => void | Promise<void>) | null;
  #deferred: NetworkServerMessage<TCommand, TSnapshot, TNotice>[] | null = null;
  #destroyed = false;
  #whenReady = Promise.withResolvers<void>();
  #refusedOnSnapshot: LedgerEntry<TCommand>[] = [];
  #receipts: ChangeReceipts<SentChange> | null;
  #detachReceipts: (() => void) | null;

  #onMessage = (
    message: NetworkServerMessage<TCommand, TSnapshot, TNotice>
  ): void => {
    if (this.#deferred === null) {
      this.#receive(message);
    }
    else {
      this.#deferred.push(message);
    }
  };

  #receive(
    message: NetworkServerMessage<TCommand, TSnapshot, TNotice>
  ): void {
    if (!isSyncMessage<TCommand, TSnapshot>(message)) {
      this.emit("notice", message);

      return;
    }

    switch (message.type) {
      case "snapshot":
        this.#receiveSnapshot(message);
        break;
      case "correction":
        this.#handleCorrection(message);
        break;
      case "catch-up":
        this.#handleCatchUp(message);
        break;
      default:
        this.#handleCommand(message.data, message.version);
    }
  }

  #onSync = (): void => {
    const previous = this.#clientId;
    this.#clientId = this.room.clientId;
    if (previous !== null && previous !== this.#clientId) {
      this.#resumingFrom ??= previous;
    }
    if (this.#resumingFrom === null) {
      this.#transmitHeld();
    }
  };

  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>,
    options: CommandSyncOptions<TCommand, TSnapshot>
  ) {
    super();

    this.room = room;
    this.#clientId = room.clientId;
    this.#integrator = new CommandIntegrator({
      ledger: this.#ledger,
      reconciler: options.reconciler,
      apply: (command) => this.emit("command", command),
      resync: () => this.#resync(),
      unreplayable: (entry) => this.#discard(entry)
    });
    this.#applySnapshot = options.applySnapshot ?? null;
    this.#receipts = options.receipts ?? null;
    this.#detachReceipts = this.#receipts?.attach() ?? null;
    this.#whenReady.promise.catch(() => undefined);
    this.room.on("message", this.#onMessage);
    this.room.on("sync", this.#onSync);
    this.room.resumeWith(
      () => this.#resume()
    );
  }

  get ready(): boolean {
    return this.#ready;
  }

  get pending(): number {
    return this.#ledger.size;
  }

  get version(): number {
    return this.#version;
  }

  whenReady(): Promise<void> {
    return this.#whenReady.promise;
  }

  keepIn(
    outbox: ChangeOutbox
  ): void {
    if (this.#clientId !== null || this.#ledger.size > 0) {
      throw new Error("Keep pending changes in an outbox before joining.");
    }

    this.#ledger.keepIn(outbox);
    const sent = this.#ledger.entries.find((entry) => entry.sent);
    this.#resumingFrom = sent?.command.clientId ?? null;
    if (this.#ledger.size > 0) {
      this.emit("unsettled");
    }
  }

  send(
    body: CommandBody<TCommand>,
    timestamp: number = Date.now(),
    basis?: number
  ): TCommand {
    return this.#enqueue(body, timestamp, basis, null);
  }

  sendChange(
    body: CommandBody<TCommand>,
    change: SentChange
  ): TCommand {
    return this.#enqueue(body, Date.now(), change.basis, change);
  }

  destroy(): void {
    this.#detachReceipts?.();
    this.#detachReceipts = null;
    this.#destroyed = true;
    this.#deferred = null;
    this.room.off("message", this.#onMessage);
    this.room.off("sync", this.#onSync);
    this.room.resumeWith(null);
    this.#ledger.clear();
  }

  get #holding(): boolean {
    return this.#resyncing || this.#resumingFrom !== null;
  }

  #enqueue(
    body: CommandBody<TCommand>,
    timestamp: number,
    basis: number | undefined,
    change: SentChange | null
  ): TCommand {
    const entry: LedgerEntry<TCommand> = {
      command: {
        ...body,
        clientId: this.room.clientId ?? this.#clientId ?? "",
        seq: 0,
        timestamp,
        ...(basis === undefined ? {} : { basis })
      } as unknown as TCommand,
      change,
      sent: false,
      applied: true
    };
    const settled = this.#ledger.size === 0;
    this.#ledger.add(entry);
    if (this.room.clientId !== null && this.#resumingFrom === null) {
      this.#transmit(entry);
    }
    if (settled) {
      this.emit("unsettled");
    }

    return entry.command;
  }

  #resume(): NetworkResume | undefined {
    const clientId = this.#resumingFrom ?? this.#clientId;
    if (clientId === null) {
      return undefined;
    }

    return this.#resyncing || this.#clientId === null ?
      { clientId } :
      {
        clientId,
        version: this.#version
      };
  }

  #transmitHeld(): void {
    for (const entry of this.#ledger.takeUnsent()) {
      this.#transmit(entry);
    }
  }

  #transmit(
    entry: LedgerEntry<TCommand>
  ): void {
    this.#ledger.markSent(entry, this.room.clientId, ++this.#seq);
    this.room.send({ ...entry.command });
  }

  #finishResume(): void {
    this.#resumingFrom = null;
    this.#ledger.markUnsent();
    this.#transmitHeld();
  }

  #discard(
    entry: LedgerEntry<TCommand>
  ): void {
    this.#ledger.discard(entry);
    this.#noteSettled([entry]);
    this.#refuse(entry);
    this.#resync();
  }

  #noteVersion(
    version: number | undefined
  ): void {
    if (version !== undefined && version > this.#version) {
      this.#version = version;
    }
  }

  #resync(): void {
    if (this.#resyncing) {
      return;
    }

    this.#resyncing = true;
    this.room.resync();
  }

  #acknowledgeFrom(
    acks: NetworkAcks | undefined
  ): LedgerEntry<TCommand>[] {
    const acknowledged: LedgerEntry<TCommand>[] = [];
    for (const clientId of [this.#resumingFrom, this.room.clientId]) {
      const seq = clientId === null ? undefined : acks?.[clientId];
      if (seq !== undefined) {
        acknowledged.push(...this.#ledger.acknowledge(clientId, seq));
      }
    }

    return acknowledged;
  }

  #answer(
    entries: readonly LedgerEntry<TCommand>[],
    version: number | undefined,
    refusedSeq?: number
  ): LedgerEntry<TCommand> | null {
    let refused: LedgerEntry<TCommand> | null = null;
    for (const entry of entries) {
      if (entry.command.seq === refusedSeq) {
        refused = entry;
      }
      else {
        this.#confirm(entry, version);
      }
    }
    this.#noteSettled(entries);

    return refused;
  }

  #confirm(
    entry: LedgerEntry<TCommand>,
    version: number | undefined
  ): void {
    this.emit("acknowledged", entry.command, version);
    if (entry.change !== null) {
      this.#receipts?.confirm(entry.change, version);
    }
  }

  #refuse(
    entry: LedgerEntry<TCommand>
  ): void {
    this.emit("refused", entry.command);
    if (entry.change !== null) {
      this.#receipts?.refuse(entry.change);
    }
  }

  #noteSettled(
    entries: readonly LedgerEntry<TCommand>[]
  ): void {
    if (entries.length > 0 && this.#ledger.size === 0) {
      this.emit("settled");
    }
  }

  #isOwn(
    command: TCommand
  ): boolean {
    return command.clientId === this.room.clientId ||
      command.clientId === this.#resumingFrom;
  }

  #handleCommand(
    command: TCommand,
    version: number | undefined
  ): void {
    if (this.#holding) {
      if (this.#isOwn(command)) {
        this.#acknowledgeEcho(command, version);
      }

      return;
    }

    if (!this.#isOwn(command) || this.#acknowledgeEcho(command, version)) {
      this.#integrator.integrate(command, version);
    }
    this.#noteVersion(version);
  }

  #acknowledgeEcho(
    command: TCommand,
    version: number | undefined
  ): boolean {
    const acknowledged = this.#ledger.acknowledge(command.clientId, command.seq);
    this.#answer(acknowledged, version);
    const landed = acknowledged.at(-1);

    return landed?.command.seq === command.seq && !landed.applied;
  }

  #handleCorrection(
    message: SyncMessage<TCommand, TSnapshot, "correction">
  ): void {
    const { data: correction } = message;
    const acknowledged = this.#acknowledgeFrom(message.acks);
    if (this.#isOwn(correction)) {
      acknowledged.push(
        ...this.#ledger.acknowledge(correction.clientId, correction.seq)
      );
    }
    const refused = this.#answer(acknowledged, undefined, message.refused);
    if (!this.#holding) {
      this.#integrator.integrate(correction);
    }
    if (refused !== null) {
      this.#refuse(refused);
    }
  }

  #handleCatchUp(
    message: SyncMessage<TCommand, TSnapshot, "catch-up">
  ): void {
    for (const command of message.data) {
      if (!this.#isOwn(command) || this.#acknowledgeEcho(command, message.version)) {
        this.#integrator.integrate(command);
      }
    }
    this.#noteVersion(message.version);
    const dropped = this.#acknowledgeFrom(message.acks);
    this.#noteSettled(dropped);
    if (this.#resumingFrom !== null) {
      this.#finishResume();
    }
    if (dropped.length > 0) {
      this.#refusedOnSnapshot.push(...dropped);
      this.#resync();
    }
  }

  #receiveSnapshot(
    message: SyncMessage<TCommand, TSnapshot, "snapshot">
  ): void {
    const applied = this.#applySnapshot?.(message.data);
    if (applied === undefined) {
      this.#handleSnapshot(message);

      return;
    }

    this.#deferred = [];
    applied.then(
      () => this.#releaseDeferred(
        () => this.#handleSnapshot(message)
      ),
      (error: unknown) => this.#releaseDeferred(() => {
        if (!this.#ready) {
          this.#whenReady.reject(error);
        }
        this.emit("snapshot-failed", error);
      })
    );
  }

  #releaseDeferred(
    settle: () => void
  ): void {
    const deferred = this.#deferred ?? [];
    this.#deferred = null;
    if (this.#destroyed) {
      return;
    }

    settle();
    for (const message of deferred) {
      this.#onMessage(message);
    }
  }

  #handleSnapshot(
    message: SyncMessage<TCommand, TSnapshot, "snapshot">
  ): void {
    const refused = this.#answer(
      this.#acknowledgeFrom(message.acks),
      message.version,
      message.refused
    );
    this.#resyncing = false;
    if (message.version !== undefined) {
      this.#version = message.version;
    }
    this.emit("snapshot", message.data);
    this.#integrator.replayPending();
    if (this.#resumingFrom !== null) {
      this.#finishResume();
    }
    if (refused !== null) {
      this.#refuse(refused);
    }
    for (const entry of this.#refusedOnSnapshot.splice(0)) {
      this.#refuse(entry);
    }

    if (!this.#ready) {
      this.#ready = true;
      this.emit("ready");
      this.#whenReady.resolve();
    }
  }
}
