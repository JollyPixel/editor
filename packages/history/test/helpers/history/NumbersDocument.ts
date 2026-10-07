// Import Internal Dependencies
import {
  CommandDocument,
  CommandHistory,
  KeyedGuard,
  type CommandChange,
  type HistoryRegistration,
  type HistoryStepInfo
} from "#src/index.ts";

export type Scope = "build" | "paint";

interface SetCommand {
  key: string;
  value: number | undefined;
}

type SetChange = CommandChange<SetCommand, number | undefined>;

export class NumbersDocument extends CommandDocument<SetCommand, Record<string, number>, number | undefined> {
  readonly id: string;
  readonly values: Map<string, number>;
  readonly locked: Set<string>;
  readonly bases: (number | undefined)[] = [];
  readonly changes: SetChange[] = [];

  constructor(
    id: string,
    options: { synced?: boolean; } = {}
  ) {
    const values = new Map<string, number>();
    const locked = new Set<string>();
    super({
      accepts: ({ key }) => !locked.has(key),
      placeable: (command) => command,
      apply: ({ key, value }) => {
        if (value === undefined) {
          values.delete(key);
        }
        else {
          values.set(key, value);
        }
      },
      load: (snapshot) => {
        values.clear();
        for (const [key, value] of Object.entries(snapshot)) {
          values.set(key, value);
        }
      },
      imageOf: ({ key }) => values.get(key),
      inverseOf: ({ key }) => (key === "cursor" ? [] : [{ key, value: values.get(key) }]),
      restored: () => Object.fromEntries(values)
    });
    this.id = id;
    this.values = values;
    this.locked = locked;
    if (options.synced === true) {
      this.receipts.attach();
    }
    this.subscribe("change", (change) => this.changes.push(change));
  }

  set(
    key: string,
    value: number | undefined
  ): SetChange | null {
    return this.commit({ key, value }) ? this.changes.at(-1)! : null;
  }

  peer(
    key: string,
    value: number,
    clientId: string
  ): void {
    this.apply({ key, value }, clientId);
  }

  echo(
    key: string,
    value: number
  ): void {
    this.replayPending({ key, value });
  }

  override applyStep(
    command: SetCommand,
    basis: number | undefined
  ): SetChange | null {
    this.bases.push(basis);

    return super.applyStep(command, basis);
  }

  registration(
    scopeOf: () => Scope | null
  ): HistoryRegistration<Scope, SetCommand, number | undefined> {
    return {
      id: this.id,
      document: this,
      keys: {
        written: ({ command }) => [command.key, ...containersOf(command.key)],
        guard: (commands) => new KeyedGuard(commands.map(({ key }) => {
          return { key, read: () => this.values.get(key) };
        }))
      },
      scopeOf,
      label: ({ command }) => `Set ${command.key}`
    };
  }
}

function containersOf(
  key: string
): string[] {
  const parts = key.split("/");

  return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join("/"));
}

export function setup(
  options: { synced?: boolean; limit?: number; } = {}
) {
  let active: Scope | null = "build";
  const history = new CommandHistory({
    scopes: ["build", "paint"],
    limit: options.limit
  });
  const document = new NumbersDocument("numbers", options);
  history.register(document.registration(() => active));
  const refused: HistoryStepInfo[] = [];
  history.on("refused", (_scope, step) => refused.push(step));

  return {
    history,
    document,
    refused,
    activate: (scope: Scope | null) => {
      active = scope;
    }
  };
}
