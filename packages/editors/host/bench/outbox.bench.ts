// Import Node.js Dependencies
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import { deleteDB } from "idb";
import type { NetworkCommandHeader } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import "../test/setup.ts";
import { PendingOutboxes } from "#src/lease/outbox/PendingOutboxes.ts";
import { printSideReport } from "./_fixtures.ts";

// CONSTANTS
const kDatabaseName = "jolly-pixel:pending-changes";
const kStrokeEdits = 64;
const kStrokeCells = 32;
const kCountedRounds = 4;

interface PaintCell {
  x: number;
  y: number;
  color: number;
}

interface PaintCommand extends NetworkCommandHeader {
  cells: PaintCell[];
}

interface IndexedDBWork {
  transactions: number;
  requests: number;
}

interface OutboxScenario {
  name: string;
  edits: number;
  run(): Promise<void>;
}

class IndexedDBCounter {
  #transactions = 0;
  #requests = 0;
  #finished = 0;
  #restores: Array<() => void> = [];

  constructor() {
    this.#intercept(IDBDatabase.prototype, "transaction", (transaction) => {
      this.#transactions++;
      if (transaction instanceof IDBTransaction) {
        const finish = (): void => {
          this.#finished++;
        };
        transaction.addEventListener("complete", finish);
        transaction.addEventListener("abort", finish);
      }
    });
    for (const method of ["get", "getKey", "put", "delete"]) {
      this.#intercept(IDBObjectStore.prototype, method, () => {
        this.#requests++;
      });
    }
    this.#intercept(IDBIndex.prototype, "getKey", () => {
      this.#requests++;
    });
  }

  work(): IndexedDBWork {
    return {
      transactions: this.#transactions,
      requests: this.#requests
    };
  }

  async drain(): Promise<void> {
    while (this.#finished < this.#transactions) {
      await setImmediate();
    }
  }

  restore(): void {
    for (const restore of this.#restores.splice(0)) {
      restore();
    }
  }

  #intercept(
    target: object,
    key: string,
    onResult: (result: unknown) => void
  ): void {
    const original: unknown = Reflect.get(target, key);
    if (typeof original !== "function") {
      throw new TypeError(`${key} is not a method`);
    }

    Reflect.set(target, key, function intercepted(
      this: unknown,
      ...args: unknown[]
    ): unknown {
      const result: unknown = Reflect.apply(original, this, args);
      onResult(result);

      return result;
    });
    this.#restores.push(() => Reflect.set(target, key, original));
  }
}

function paintCommand(): PaintCommand {
  return {
    clientId: "bench-client",
    seq: 0,
    timestamp: 0,
    cells: Array.from({ length: kStrokeCells }, (_, index) => {
      return {
        x: index,
        y: index,
        color: 0xff00ff
      };
    })
  };
}

const suite = defineSuite("lease / RoomOutbox on fake-indexeddb", async(bench) => {
  await deleteDB(kDatabaseName);
  const outboxes = await PendingOutboxes.open();
  if (outboxes === null) {
    throw new Error("PendingOutboxes needs IndexedDB and Web Locks");
  }
  const outbox = outboxes.open("pixelart:bench");
  const counter = new IndexedDBCounter();
  const stroke = Array.from({ length: kStrokeEdits }, paintCommand);
  const single = paintCommand();
  let seq = 0;

  const scenarios: OutboxScenario[] = [
    {
      name: "one edit, acknowledged a task later",
      edits: 1,
      run: async() => {
        outbox.keep(single);
        Object.assign(single, { seq: ++seq });
        outbox.keep(single);
        await setImmediate();
        outbox.drop(single);
      }
    },
    {
      name: `stroke of ${kStrokeEdits} edits, acknowledged together`,
      edits: kStrokeEdits,
      run: async() => {
        for (const command of stroke) {
          outbox.keep(command);
          Object.assign(command, { seq: ++seq });
          outbox.keep(command);
          await setImmediate();
        }
        for (const command of stroke) {
          outbox.drop(command);
        }
      }
    }
  ];

  const results: object[] = [];
  for (const scenario of scenarios) {
    const before = counter.work();
    for (let round = 0; round < kCountedRounds; round++) {
      await scenario.run();
      await counter.drain();
    }
    const after = counter.work();
    const edits = scenario.edits * kCountedRounds;
    results.push({
      scenario: scenario.name,
      "transactions/edit": (after.transactions - before.transactions) / edits,
      "requests/edit": (after.requests - before.requests) / edits
    });

    bench.add(scenario.name, async() => {
      await scenario.run();
      await counter.drain();
    });
  }
  printSideReport("lease / RoomOutbox IndexedDB work per edit", results);

  return async() => {
    counter.restore();
    await outboxes.close();
    await deleteDB(kDatabaseName);
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
