// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  ChangeSourceAdapter,
  CommandHistory,
  KeyedGuard,
  type DocumentResetCause,
  type SourceChange
} from "#src/index.ts";

type Write = {
  key: string;
  value: number;
};

type CounterEvents = {
  change: (change: SourceChange<Write>) => void;
  reset: (cause: DocumentResetCause) => void;
};

class Counters extends Emitter<CounterEvents> {
  readonly values = new Map<string, number>();

  write(
    command: Write,
    origin: SourceChange<Write>["origin"] = "local"
  ): SourceChange<Write> {
    const inverse: Write = {
      key: command.key,
      value: this.values.get(command.key) ?? 0
    };
    this.values.set(command.key, command.value);
    const change: SourceChange<Write> = {
      command,
      origin,
      inverse: origin === "local" ? [inverse] : [],
      clientId: origin === "remote" ? "peer" : null
    };
    this.emit("change", change);

    return change;
  }

  applyStep(
    command: Write
  ): SourceChange<Write> {
    return this.write(command);
  }
}

function setup() {
  const counters = new Counters();
  const adapter = new ChangeSourceAdapter(counters);
  const history = new CommandHistory({ scopes: ["main"] });
  history.register({
    id: "counters",
    document: adapter,
    keys: {
      written: (change) => [change.command.key],
      guard: (commands) => new KeyedGuard(commands.map(({ key }) => {
        return {
          key,
          read: () => counters.values.get(key)
        };
      }))
    },
    scopeOf: () => "main"
  });

  return {
    counters,
    adapter,
    history
  };
}

describe("ChangeSourceAdapter", () => {
  test("hands the same history change to every reader of one source change", () => {
    const { counters, adapter } = setup();
    let heard: unknown = null;
    adapter.subscribe("change", (change) => {
      heard = change;
    });

    const change = counters.write({ key: "a", value: 1 });

    assert.equal(heard, adapter.adapt(change));
    assert.deepEqual(adapter.adapt(change).inverse, [{ key: "a", value: 0 }]);
  });

  test("undoes a local change through the source and stamps the replay with the step's version", () => {
    const { counters, adapter, history } = setup();
    adapter.receipts.attach();
    const sent: (number | undefined)[] = [];
    counters.on("change", (change) => sent.push(adapter.adapt(change).basis));

    const change = counters.write({ key: "a", value: 1 });
    adapter.receipts.confirm(adapter.adapt(change), 4);
    history.undo("main");

    assert.equal(counters.values.get("a"), 0);
    assert.deepEqual(sent, [undefined, 4]);
  });

  test("a remote change over a guarded key refuses the step and names the peer", () => {
    const { counters, history } = setup();
    counters.write({ key: "a", value: 1 });

    counters.write({ key: "a", value: 7 }, "remote");

    assert.deepEqual(history.state("main").refused, [
      { label: null, refused: { reason: "peer", clientId: "peer" } }
    ]);
  });

  test("forwards a load as a reset and stops forwarding once disposed", () => {
    const { counters, adapter } = setup();
    const causes: DocumentResetCause[] = [];
    adapter.subscribe("reset", (cause) => causes.push(cause));

    counters.emit("reset", "load");
    adapter.dispose();
    counters.emit("reset", "load");

    assert.deepEqual(causes, ["load"]);
  });
});
