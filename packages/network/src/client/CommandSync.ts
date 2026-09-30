// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { Room } from "./Room.ts";
import type { CommandReconciler } from "./CommandReconciler.ts";
import {
  LastWriteWinsResolver,
  type ConflictRecord,
  type ConflictResolver
} from "../sync/ConflictResolver.ts";
import type {
  NetworkAcks,
  NetworkCommandHeader,
  NetworkResume,
  NetworkServerMessage,
  NetworkServerNoticeOf,
  NetworkSyncMessage
} from "../sync/types.ts";

// CONSTANTS
const kMaxHeldCommands = 500;
const kMaxHeldBytes = 2 * 1024 * 1024;

export type CommandBody<TCommand extends NetworkCommandHeader> =
  TCommand extends unknown ?
    Omit<TCommand, keyof NetworkCommandHeader> :
    never;

interface LedgerEntry<TCommand extends NetworkCommandHeader> {
  readonly command: TCommand;
  sent: boolean;
  applied: boolean;
}

interface KeyedEntry<TCommand extends NetworkCommandHeader> {
  readonly entry: LedgerEntry<TCommand>;
  readonly keys: ReadonlySet<string>;
}

function isSyncMessage<TCommand, TSnapshot>(
  message: { type: string; }
): message is NetworkSyncMessage<TCommand, TSnapshot> {
  return message.type === "snapshot" ||
    message.type === "command" ||
    message.type === "correction" ||
    message.type === "catch-up";
}

export interface CommandSyncOptions<TCommand extends NetworkCommandHeader> {
  reconciler?: CommandReconciler<TCommand>;
  resolver?: ConflictResolver<TCommand>;
}

export type CommandSyncEventMap<
  TCommand,
  TSnapshot,
  TNotice
> = {
  ready: () => void;
  snapshot: (snapshot: TSnapshot) => void;
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
  #overflowed = false;
  #heldBytes = 0;
  #clientId: string | null = null;
  #resumingFrom: string | null = null;
  #ledger: LedgerEntry<TCommand>[] = [];
  #reconciler: CommandReconciler<TCommand> | null;
  #resolver: ConflictResolver<TCommand>;
  #whenReady = new Promise<void>((resolve) => {
    this.once("ready", resolve);
  });

  #onMessage = (
    message: NetworkServerMessage<TCommand, TSnapshot, TNotice>
  ): void => {
    if (!isSyncMessage<TCommand, TSnapshot>(message)) {
      this.emit("notice", message);

      return;
    }

    switch (message.type) {
      case "snapshot":
        this.#handleSnapshot(message.data, message.version, message.acks);
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
  };

  #onSync = (): void => {
    const previous = this.#clientId;
    this.#clientId = this.room.clientId;
    if (previous !== null && previous !== this.#clientId) {
      if (!this.#overflowed) {
        this.#resumingFrom = previous;

        return;
      }

      this.#ledger = [];
      this.#overflowed = false;
    }

    this.#transmitHeld();
  };

  constructor(
    room: Room<TCommand, NetworkServerMessage<TCommand, TSnapshot, TNotice>>,
    options: CommandSyncOptions<TCommand> = {}
  ) {
    super();
    this.room = room;
    this.#reconciler = options.reconciler ?? null;
    this.#resolver = options.resolver ?? new LastWriteWinsResolver();
    this.room.on("message", this.#onMessage);
    this.room.on("sync", this.#onSync);
    this.room.resumeWith(() => this.#resume());
  }

  get ready(): boolean {
    return this.#ready;
  }

  get pending(): number {
    return this.#ledger.length;
  }

  get version(): number {
    return this.#version;
  }

  get overflowed(): boolean {
    return this.#overflowed;
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
      this.#ledger.push(entry);
      this.#transmit(entry);
    }
    else if (!this.#overflowed) {
      this.#ledger.push(entry);
      this.#hold(body);
    }

    return entry.command;
  }

  destroy(): void {
    this.room.off("message", this.#onMessage);
    this.room.off("sync", this.#onSync);
    this.room.resumeWith(null);
    this.#ledger = [];
  }

  #resume(): NetworkResume | undefined {
    if (this.#clientId === null || this.#overflowed) {
      return undefined;
    }

    return this.#resyncing ?
      { clientId: this.#clientId } :
      {
        clientId: this.#clientId,
        version: this.#version
      };
  }

  #hold(
    body: CommandBody<TCommand>
  ): void {
    this.#heldBytes += JSON.stringify(body).length;
    if (
      this.#ledger.length > kMaxHeldCommands ||
      this.#heldBytes > kMaxHeldBytes
    ) {
      this.#overflowed = true;
      this.emit("overflow");
    }
  }

  #transmitHeld(): void {
    this.#heldBytes = 0;
    for (const entry of this.#ledger) {
      if (!entry.sent) {
        this.#transmit(entry);
      }
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
    for (const entry of this.#ledger) {
      entry.sent = false;
    }
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
    let remaining = this.#ledger.findIndex(
      (entry) => !entry.sent ||
        entry.command.clientId !== clientId ||
        entry.command.seq > seq
    );
    if (remaining === -1) {
      remaining = this.#ledger.length;
    }
    const acknowledged = this.#ledger.slice(0, remaining);
    this.#ledger = this.#ledger.slice(remaining);
    if (acknowledged.length > 0 && this.#ledger.length === 0) {
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
      this.#integrate(command, version);
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
      this.#integrate(command, version);
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

    if (this.#reconciler === null) {
      this.emit("command", correction);
      this.#replayPending();

      return;
    }

    this.#integrate(correction);
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
        this.#integrate(command);
      }
    }
    this.#noteVersion(version);
    this.#acknowledgeFrom(acks);
    if (this.#resumingFrom !== null) {
      this.#finishResume();
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
    this.#replayPending();
    if (this.#resumingFrom !== null) {
      this.#finishResume();
    }

    if (!this.#ready) {
      this.#ready = true;
      this.emit("ready");
    }
  }

  #integrate(
    command: TCommand,
    version?: number
  ): void {
    const reconciler = this.#reconciler;
    if (reconciler === null || this.#ledger.length === 0) {
      this.emit("command", command);

      return;
    }

    if (!this.#integrateKeyed(reconciler, command, version)) {
      this.#rebase(reconciler, command);
    }
  }

  #integrateKeyed(
    reconciler: CommandReconciler<TCommand>,
    command: TCommand,
    version: number | undefined
  ): boolean {
    const keys = reconciler.keys(command);
    if (keys === null) {
      return false;
    }

    const pending: KeyedEntry<TCommand>[] = [];
    for (const entry of this.#ledger) {
      const pendingKeys = entry.applied ? reconciler.keys(entry.command) : null;
      if (pendingKeys === null) {
        return false;
      }
      pending.push({
        entry,
        keys: new Set(pendingKeys)
      });
    }

    const existing: ConflictRecord = version === undefined ?
      command :
      { ...command, version };
    const keep: number[] = [];
    const outliving = new Set<LedgerEntry<TCommand>>();
    keys.forEach((key, index) => {
      const winners = pending.filter(
        (keyed) => this.#outlives(keyed, key, existing)
      );
      if (winners.length === 0) {
        keep.push(index);
      }
      for (const winner of winners) {
        outliving.add(winner.entry);
      }
    });

    if (keep.length === keys.length) {
      this.emit("command", command);
    }
    else if (keep.length > 0) {
      const narrowed = reconciler.narrow(command, keep);
      if (narrowed === null) {
        this.emit("command", command);
        for (const entry of outliving) {
          entry.applied = reconciler.replay(entry.command);
        }
      }
      else {
        this.emit("command", narrowed);
      }
    }

    return true;
  }

  #outlives(
    keyed: KeyedEntry<TCommand>,
    key: string,
    existing: ConflictRecord
  ): boolean {
    return keyed.keys.has(key) && this.#resolver.resolve({
      incoming: keyed.entry.command,
      existing
    }) === "accept";
  }

  #rebase(
    reconciler: CommandReconciler<TCommand>,
    command: TCommand
  ): void {
    const applied = this.#ledger
      .filter((entry) => entry.applied)
      .map((entry) => entry.command);
    if (!reconciler.revert(applied)) {
      this.#resyncing = true;
      this.room.resync();

      return;
    }

    this.emit("command", command);
    this.#replayPending();
  }

  #replayPending(): void {
    const reconciler = this.#reconciler;
    for (const entry of [...this.#ledger]) {
      if (reconciler === null) {
        this.emit("command", entry.command);
      }
      else {
        entry.applied = reconciler.replay(entry.command);
      }
    }
  }
}
