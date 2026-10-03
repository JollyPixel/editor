// Import Internal Dependencies
import {
  CommandSync,
  type ClientEnvelope,
  type CommandReconciler
} from "#src/index.ts";
import { RoomHarness } from "../../helpers/client/RoomHarness.ts";
import type { Choices } from "./Choices.ts";
import {
  TOY_LIST_ITEMS,
  ToyDocument,
  type ToyBody,
  type ToyCommand,
  type ToyInverse,
  type ToySnapshot
} from "./ToyDocument.ts";
import type { ToyMessage } from "./ToyServer.ts";

export type ToyScenario = "registers" | "list" | "tree" | "mixed";

type ToyGenerator = (client: ToyClient, choices: Choices) => ToyBody;

// CONSTANTS
const kRegisterKeys = ["k0", "k1", "k2", "k3"];
const kGenerateAttempts = 8;
const kGenerators: Record<ToyScenario, readonly ToyGenerator[]> = {
  registers: [generateSet],
  list: [generateMove],
  tree: [
    generateAdd,
    generateAdd,
    generateRemove,
    generateReparent,
    generateReparent
  ],
  mixed: [
    generateSet,
    generateMove,
    generateAdd,
    generateRemove,
    generateReparent
  ]
};

export class ToyClient {
  readonly id: string;
  readonly skew: number;
  readonly opaque: ReadonlySet<ToyBody["action"]>;
  readonly view = new ToyDocument();
  readonly harness = new RoomHarness<ToyCommand, ToyMessage>();
  readonly sync: CommandSync<ToyCommand, ToySnapshot>;
  readonly inbox: ToyMessage[] = [];

  #outboxIndex = 0;
  #nodes = 0;
  #inverses = new WeakMap<ToyCommand, ToyInverse>();

  constructor(
    id: string,
    skew: number,
    opaque: Iterable<ToyBody["action"]> = []
  ) {
    this.id = id;
    this.skew = skew;
    this.opaque = new Set(opaque);
    this.harness.room.join();
    this.harness.admit(id);
    this.sync = new CommandSync<ToyCommand, ToySnapshot>(this.harness.room, {
      reconciler: this.#reconciler()
    });
    this.sync.on("snapshot", (snapshot) => this.view.load(snapshot));
    this.sync.on("command", (command) => {
      if (this.view.accepts(command)) {
        this.view.apply(command);
      }
    });
  }

  get outbound(): number {
    return this.harness.sent.length - this.#outboxIndex;
  }

  edit(
    choices: Choices,
    scenario: ToyScenario,
    now: number
  ): void {
    const body = this.#generate(choices, scenario);
    const inverse = this.view.apply(body);
    this.#capture(this.sync.send(body, now + this.skew), inverse);
  }

  takeOutbound(): ClientEnvelope {
    return this.harness.sent[this.#outboxIndex++];
  }

  deliverInbound(): void {
    this.harness.serverMessage(this.inbox.shift()!);
  }

  nextNodeId(): string {
    return `${this.id}-${this.#nodes++}`;
  }

  #reconciler(): CommandReconciler<ToyCommand> {
    return {
      keys: (command) => (command.action === "set" ? command.keys : null),
      narrow: (command, keep) => {
        if (command.action !== "set") {
          return null;
        }

        return {
          ...command,
          keys: keep.map((index) => command.keys[index]),
          values: keep.map((index) => command.values[index])
        };
      },
      revert: (pending) => {
        const inverses = pending.map((command) => this.#inverses.get(command));
        if (inverses.some((inverse) => inverse === undefined)) {
          return false;
        }
        for (const inverse of inverses.reverse()) {
          inverse!();
        }

        return true;
      },
      replay: (command) => {
        if (!this.view.accepts(command)) {
          return false;
        }
        this.#capture(command, this.view.apply(command));

        return true;
      }
    };
  }

  #capture(
    command: ToyCommand,
    inverse: ToyInverse
  ): void {
    if (this.opaque.has(command.action)) {
      this.#inverses.delete(command);
    }
    else {
      this.#inverses.set(command, inverse);
    }
  }

  #generate(
    choices: Choices,
    scenario: ToyScenario
  ): ToyBody {
    const generators = kGenerators[scenario];
    for (let attempt = 0; attempt < kGenerateAttempts; attempt++) {
      const body = choices.pick(generators)(this, choices);
      if (this.view.accepts(body)) {
        return body;
      }
    }

    return generateSet(this, choices);
  }
}

function generateSet(
  _client: ToyClient,
  choices: Choices
): ToyBody {
  const keys = [...new Set(
    Array.from({ length: 1 + choices.int(3) }, () => choices.pick(kRegisterKeys))
  )];

  return {
    action: "set",
    keys,
    values: keys.map(() => choices.int(100))
  };
}

function generateMove(
  _client: ToyClient,
  choices: Choices
): ToyBody {
  return {
    action: "move",
    item: choices.pick(TOY_LIST_ITEMS),
    toIndex: choices.int(TOY_LIST_ITEMS.length)
  };
}

function randomParent(
  client: ToyClient,
  choices: Choices
): string | null {
  const nodes = [...client.view.tree.keys()];

  return nodes.length === 0 || choices.int(3) === 0 ?
    null :
    choices.pick(nodes);
}

function generateAdd(
  client: ToyClient,
  choices: Choices
): ToyBody {
  return {
    action: "add",
    id: client.nextNodeId(),
    parentId: randomParent(client, choices)
  };
}

function generateRemove(
  client: ToyClient,
  choices: Choices
): ToyBody {
  const nodes = [...client.view.tree.keys()];

  return nodes.length === 0 ?
    generateAdd(client, choices) :
    { action: "remove", id: choices.pick(nodes) };
}

function generateReparent(
  client: ToyClient,
  choices: Choices
): ToyBody {
  const nodes = [...client.view.tree.keys()];

  return nodes.length === 0 ?
    generateAdd(client, choices) :
    {
      action: "reparent",
      id: choices.pick(nodes),
      parentId: randomParent(client, choices)
    };
}
