// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandDocument,
  type CommandChange,
  type DocumentResetCause
} from "#src/index.ts";

interface SetCommand {
  key: string;
  value: number;
}

type Values = Record<string, number>;

class ValuesDocument extends CommandDocument<SetCommand, Values, number | undefined> {
  readonly values = new Map<string, number>();
  readonly changes: CommandChange<SetCommand, number | undefined>[] = [];
  readonly resets: DocumentResetCause[] = [];

  constructor() {
    const values = new Map<string, number>();
    super({
      accepts: ({ value }) => value >= 0,
      placeable: ({ key, value }) => {
        return { key: `${key}'`, value };
      },
      apply: ({ key, value }) => values.set(key, value),
      load: (snapshot) => {
        values.clear();
        for (const [key, value] of Object.entries(snapshot)) {
          values.set(key, value);
        }
      },
      imageOf: ({ key }) => values.get(key),
      inverseOf: ({ key }) => [{ key, value: values.get(key) ?? 0 }],
      restored: (images) => {
        return { restored: images.length };
      }
    });
    this.values = values;
    this.subscribe("change", (change) => this.changes.push(change));
    this.subscribe("reset", (cause) => this.resets.push(cause));
  }

  set(
    key: string,
    value: number
  ): boolean {
    return this.commit({ key, value });
  }
}

describe("CommandDocument", () => {
  test("a local edit carries the image and inverse read before it applied", () => {
    const document = new ValuesDocument();
    document.set("a", 1);

    document.set("a", 2);
    const change = document.changes.at(-1);

    assert.deepEqual(
      [change?.command, change?.origin, change?.image, change?.inverse, change?.clientId],
      [{ key: "a", value: 2 }, "local", 1, [{ key: "a", value: 1 }], null]
    );
  });

  test("a command the state refuses changes nothing and emits nothing", () => {
    const document = new ValuesDocument();

    assert.equal(document.set("a", -1), false);
    assert.equal(document.apply({ key: "a", value: -1 }, "peer"), false);
    assert.equal(document.replayPending({ key: "a", value: -1 }), null);
    assert.equal(document.changes.length, 0);
  });

  test("peer and replayed changes carry no inverse", () => {
    const document = new ValuesDocument();

    document.apply({ key: "a", value: 1 }, "peer");
    document.replayPending({ key: "b", value: 2 });

    assert.deepEqual(
      document.changes.map(({ origin, clientId, inverse }) => [origin, clientId, inverse]),
      [["remote", "peer", []], ["replay", null, []]]
    );
  });

  test("a step applies the placeable command as a local edit with its basis", () => {
    const document = new ValuesDocument();

    const change = document.applyStep({ key: "a", value: 1 }, 7);
    document.applyStep({ key: "b", value: 1 }, undefined);

    assert.deepEqual(change?.command, { key: "a'", value: 1 });
    assert.equal(change?.origin, "local");
    assert.equal(change?.basis, 7);
    assert.equal(document.changes.at(-1)?.basis, undefined);
  });

  test("load resets with \"load\", and revert with \"rewind\" only when it has images", () => {
    const document = new ValuesDocument();

    document.load({ a: 1 });
    document.revert([]);
    document.revert([1, undefined]);

    assert.deepEqual(document.resets, ["load", "rewind"]);
    assert.deepEqual(Object.fromEntries(document.values), { restored: 2 });
  });
});
