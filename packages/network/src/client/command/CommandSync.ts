// Import Third-party Dependencies
import { Emitter, once } from "@openally/emitt";

// Import Internal Dependencies
import type { Room } from "../Room.ts";
import type { CommandReconciler } from "./CommandReconciler.ts";
import { CommandIntegrator } from "./CommandIntegrator.ts";
import {
  PendingLedger,
  type LedgerEntry
} from "./PendingLedger.ts";
import {
  LastWriteWinsResolver,
  type ConflictResolver
} from "../../sync/ConflictResolver.ts";
import type {
  NetworkAcks,
  NetworkCommandHeader,
  NetworkResume,
  NetworkServerMessage,
  NetworkServerNoticeOf,
  NetworkSyncMessage
} from "../../sync/types.ts";

export type CommandBody<TCommand extends NetworkCommandHeader> =
  TCommand extends unknown ?
    Omit<TCommand, keyof NetworkCommandHeader> :
    never;

function isSyncMessage<TCommand, TSnapshot>(
  message: { type: string; }
): message is NetworkSyncMessage<TCommand, TSnapshot> {
  return message.type === "snapshot" ||
    message.type === "command" ||
    message.type === "correction" ||
    message.type === "catch-up";
}

export interface CommandSyncOptions<
  TCommand extends NetworkCommandHeader,
  TSnapshot = unknown
> {
  reconciler?: CommandReconciler<TCommand>;
  resolver?: ConflictResolver<TCommand>;
  applySnapshot?: (snapshot: TSnapshot) => void | Promise<void>;
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
  overflow: () => void;
  acknowledged: (command: TCommand, version: number | undefined) => void;
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
  #whenReady: Promise<void> = once(this, "ready").then(() => undefined);

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
        this.#receiveSnapshot(message.data, message.version, message.acks);
        break;
      case "correction":
        this.#handleCorrection(message.data, message.acks);
        break;
      case "catch-up":
        this.#handleCatchUp(message.data, message.version, message.acks);
        break;
      default:
        this.#handleCommand(message.data, message.version);
    }
  }

  #onSync = (): void => {
    const previous = this.#clientId;
    this.#clientId = this.room.clientId;
    if (previous !== null && previous !== this.#clientId) {
      if (!this.#ledger.overflowed) {
        this.#resumingFrom = previous;

        return;
      }

      this.#ledger.clear();
    }

    this.#transmitHeld();
  };

  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>,
    options: CommandSyncOptions<TCommand, TSnapshot> = {}
  ) {
    super();
    this.room = room;
    this.#integrator = new CommandIntegrator({
      ledger: this.#ledger,
      reconciler: options.reconciler ?? null,
      resolver: options.resolver ?? new LastWriteWinsResolver(),
      apply: (command) => this.emit("command", command),
      resync: () => {
        this.#resyncing = true;
        this.room.resync();
      }
    });
    this.#applySnapshot = options.applySnapshot ?? null;
    this.room.on("message", this.#onMessage);
    this.room.on("sync", this.#onSync);
    this.room.resumeWith(() => this.#resume());
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

  get overflowed(): boolean {
    return this.#ledger.overflowed;
  }

  whenReady(): Promise<void> {
    return this.#whenReady;
  }

  send(
    body: CommandBody<TCommand>,
    timestamp: number = Date.now(),
    basis?: number
  ): TCommand {
    const entry: LedgerEntry<TCommand> = {
      command: {
        ...body,
        clientId: this.room.clientId ?? this.#clientId ?? "",
        seq: 0,
        timestamp,
        ...(basis === undefined ? {} : { basis })
      } as unknown as TCommand,
      sent: false,
      applied: true
    };
    if (this.room.clientId !== null && this.#resumingFrom === null) {
      this.#ledger.add(entry);
      this.#transmit(entry);
    }
    else if (!this.#ledger.overflowed && this.#ledger.hold(entry, body)) {
      this.emit("overflow");
    }

    return entry.command;
  }

  destroy(): void {
    this.#destroyed = true;
    this.#deferred = null;
    this.room.off("message", this.#onMessage);
    this.room.off("sync", this.#onSync);
    this.room.resumeWith(null);
    this.#ledger.clear();
  }

  #resume(): NetworkResume | undefined {
    if (this.#clientId === null || this.#ledger.overflowed) {
      return undefined;
    }

    return this.#resyncing ?
      { clientId: this.#clientId } :
      {
        clientId: this.#clientId,
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
    Object.assign(entry.command, {
      clientId: this.room.clientId,
      seq: ++this.#seq
    });
    entry.sent = true;
    this.room.send({ ...entry.command });
  }

  #finishResume(): void {
    this.#resumingFrom = null;
    this.#ledger.markUnsent();
    this.#transmitHeld();
  }

  #noteVersion(
    version: number | undefined
  ): void {
    if (version !== undefined && version > this.#version) {
      this.#version = version;
    }
  }

  #acknowledge(
    clientId: string | null,
    seq: number
  ): LedgerEntry<TCommand>[] {
    const acknowledged = this.#ledger.acknowledge(clientId, seq);
    if (acknowledged.length > 0 && this.#ledger.size === 0) {
      this.emit("settled");
    }

    return acknowledged;
  }

  #acknowledgeFrom(
    acks: NetworkAcks | undefined
  ): void {
    for (const clientId of [this.#resumingFrom, this.room.clientId]) {
      const seq = clientId === null ? undefined : acks?.[clientId];
      if (seq !== undefined) {
        this.#acknowledge(clientId, seq);
      }
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
    if (this.#resyncing || this.#resumingFrom !== null) {
      if (this.#isOwn(command)) {
        this.#acknowledge(command.clientId, command.seq);
      }

      return;
    }

    if (this.#isOwn(command)) {
      this.#acknowledgeEcho(command, version);
    }
    else {
      this.#integrator.integrate(command, version);
    }
    this.#noteVersion(version);
  }

  #acknowledgeEcho(
    command: TCommand,
    version?: number
  ): void {
    const acknowledged = this.#acknowledge(command.clientId, command.seq);
    const landed = acknowledged.at(-1);
    if (landed === undefined || landed.command.seq !== command.seq) {
      return;
    }

    this.emit("acknowledged", landed.command, version);
    if (!landed.applied) {
      this.#integrator.integrate(command, version);
    }
  }

  #handleCorrection(
    correction: TCommand,
    acks: NetworkAcks | undefined
  ): void {
    this.#acknowledgeFrom(acks);
    if (this.#isOwn(correction)) {
      this.#acknowledge(correction.clientId, correction.seq);
    }
    if (this.#resyncing || this.#resumingFrom !== null) {
      return;
    }

    this.#integrator.integrateCorrection(correction);
  }

  #handleCatchUp(
    commands: readonly TCommand[],
    version: number,
    acks: NetworkAcks | undefined
  ): void {
    for (const command of commands) {
      if (this.#isOwn(command)) {
        this.#acknowledgeEcho(command);
      }
      else {
        this.#integrator.integrate(command);
      }
    }
    this.#noteVersion(version);
    this.#acknowledgeFrom(acks);
    if (this.#resumingFrom !== null) {
      this.#finishResume();
    }
  }

  #receiveSnapshot(
    snapshot: TSnapshot,
    version: number | undefined,
    acks: NetworkAcks | undefined
  ): void {
    const applied = this.#applySnapshot?.(snapshot);
    if (applied === undefined) {
      this.#handleSnapshot(snapshot, version, acks);

      return;
    }

    this.#deferred = [];
    applied.then(
      () => this.#releaseDeferred(
        () => this.#handleSnapshot(snapshot, version, acks)
      ),
      (error: unknown) => this.#releaseDeferred(
        () => this.emit("snapshot-failed", error)
      )
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
    snapshot: TSnapshot,
    version: number | undefined,
    acks: NetworkAcks | undefined
  ): void {
    this.#acknowledgeFrom(acks);
    this.#resyncing = false;
    if (version !== undefined) {
      this.#version = version;
    }
    this.emit("snapshot", snapshot);
    this.#integrator.replayPending();
    if (this.#resumingFrom !== null) {
      this.#finishResume();
    }

    if (!this.#ready) {
      this.#ready = true;
      this.emit("ready");
    }
  }
}
