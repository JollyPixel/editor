// Import Internal Dependencies
import {
  ConflictTracker,
  LastWriteWinsResolver,
  type Admission,
  type NetworkServerMessage
} from "#src/index.ts";
import {
  ToyDocument,
  type ToyCommand,
  type ToySnapshot
} from "./ToyDocument.ts";

export type ToyMessage = NetworkServerMessage<ToyCommand, ToySnapshot>;

type Deliver = (message: ToyMessage) => void;

export class ToyServer {
  readonly state = new ToyDocument();

  now = 0;
  version = 0;

  #versioned: boolean;
  #tracker = new ConflictTracker(new LastWriteWinsResolver());
  #members = new Map<string, Deliver>();
  #processed = new Map<string, number>();

  constructor(
    versioned = true
  ) {
    this.#versioned = versioned;
  }

  connect(
    clientId: string,
    deliver: Deliver
  ): void {
    this.#members.set(clientId, deliver);
    deliver({
      type: "snapshot",
      data: this.state.toJSON()
    });
  }

  receive(
    clientId: string,
    payload: ToyCommand
  ): void {
    const command: ToyCommand = {
      ...payload,
      clientId,
      timestamp: Math.min(payload.timestamp, this.now)
    };
    this.#processed.set(clientId, command.seq);

    const admission = this.#arbitrate(command);
    if (admission === null) {
      this.#resync(clientId, command, null);

      return;
    }

    this.version++;
    const version = this.#versioned ? this.version : undefined;
    admission.commit(version);
    this.state.apply(admission.command);
    for (const deliver of this.#members.values()) {
      deliver({
        type: "command",
        data: admission.command,
        version
      });
    }
    if (admission.command !== command) {
      this.#resync(clientId, command, admission.command);
    }
  }

  resync(
    clientId: string
  ): void {
    this.#members.get(clientId)!({
      type: "snapshot",
      data: this.state.toJSON(),
      acks: {
        [clientId]: this.#processed.get(clientId) ?? 0
      }
    });
  }

  #arbitrate(
    command: ToyCommand
  ): Admission<ToyCommand> | null {
    if (!this.state.accepts(command)) {
      return null;
    }

    switch (command.action) {
      case "set":
        return this.#admitSet(command);
      case "reparent":
        return this.#tracker.admit(command, [`parent:${command.id}`]);
      default:
        return this.#tracker.admit(command, []);
    }
  }

  #admitSet(
    command: Extract<ToyCommand, { action: "set"; }>
  ): Admission<ToyCommand> | null {
    const { indices, commit } = this.#tracker.admitEach(
      command,
      command.keys
    );
    if (indices.length === 0) {
      return null;
    }
    if (indices.length === command.keys.length) {
      return {
        command,
        commit
      };
    }

    return {
      command: {
        ...command,
        keys: indices.map((index) => command.keys[index]),
        values: indices.map((index) => command.values[index])
      },
      commit
    };
  }

  #resync(
    clientId: string,
    command: ToyCommand,
    admitted: ToyCommand | null
  ): void {
    const deliver = this.#members.get(clientId)!;
    const acks = {
      [clientId]: this.#processed.get(clientId)!
    };
    if (command.action !== "set") {
      deliver({
        type: "snapshot",
        data: this.state.toJSON(),
        acks
      });

      return;
    }

    const kept = new Set(admitted?.action === "set" ? admitted.keys : []);
    const rejected = command.keys.filter((key) => !kept.has(key));
    deliver({
      type: "correction",
      data: {
        clientId: command.clientId,
        seq: command.seq,
        timestamp: command.timestamp,
        action: "set",
        keys: rejected,
        values: rejected.map((key) => this.state.registers.get(key)!)
      },
      acks
    });
  }
}
