// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import {
  ConflictTracker,
  LastWriteWinsResolver,
  type NetworkCommandHeader
} from "#src/index.ts";

// CONSTANTS
const kClients = ["A", "B", "C"];
const kKeys = ["k1", "k2", "k3"];

interface KeyedCommand {
  header: NetworkCommandHeader;
  keys: string[];
}

const kHeader: fc.Arbitrary<NetworkCommandHeader> = fc.record({
  clientId: fc.constantFrom(...kClients),
  seq: fc.nat(),
  timestamp: fc.integer({ min: 0, max: 20 })
});

const kRun = fc.tuple(
  ...kClients.map((clientId) => fc.array(
    fc.tuple(fc.integer({ min: 0, max: 3 }), fc.subarray(kKeys, { minLength: 1 })),
    { maxLength: 6 }
  ).map((steps) => {
    let timestamp = 0;

    return steps.map(([delta, keys], seq): KeyedCommand => {
      timestamp += delta;

      return {
        header: { clientId, seq, timestamp },
        keys
      };
    });
  }))
);

function interleave(
  runs: readonly KeyedCommand[][],
  picks: readonly number[]
): KeyedCommand[] {
  const queues = runs.map((run) => [...run]);
  const merged: KeyedCommand[] = [];
  for (const pick of picks) {
    const command = queues[pick % queues.length].shift();
    if (command !== undefined) {
      merged.push(command);
    }
  }

  return [...merged, ...queues.flat()];
}

function isNewer(
  a: NetworkCommandHeader,
  b: NetworkCommandHeader
): boolean {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp > b.timestamp;
  }
  if (a.clientId !== b.clientId) {
    return a.clientId > b.clientId;
  }

  return a.seq > b.seq;
}

describe("LastWriteWinsResolver properties", () => {
  test("of two unversioned writes from different clients, exactly one wins over the other", () => {
    const resolver = new LastWriteWinsResolver();

    fc.assert(
      fc.property(kHeader, kHeader, (a, b) => {
        fc.pre(a.clientId !== b.clientId);
        const aWins = resolver.resolve({ incoming: a, existing: b }) === "accept";
        const bWins = resolver.resolve({ incoming: b, existing: a }) === "accept";

        assert.notStrictEqual(aWins, bWins);
      })
    );
  });
});

describe("ConflictTracker properties", () => {
  test("each key ends on its newest write, whatever order clients' commands interleave in", () => {
    fc.assert(
      fc.property(
        kRun,
        fc.array(fc.nat(), { maxLength: 18 }),
        (runs, picks) => {
          const tracker = new ConflictTracker(new LastWriteWinsResolver());
          const winners = new Map<string, NetworkCommandHeader>();

          for (const { header, keys } of interleave(runs, picks)) {
            const admission = tracker.admitEach(header, keys);
            admission.commit();
            for (const index of admission.indices) {
              winners.set(keys[index], header);
            }
          }

          for (const key of kKeys) {
            const newest = runs
              .flat()
              .filter((command) => command.keys.includes(key))
              .map((command) => command.header)
              .reduce<NetworkCommandHeader | undefined>(
                (best, header) => (best === undefined || isNewer(header, best) ? header : best),
                undefined
              );

            assert.deepStrictEqual(winners.get(key), newest, key);
          }
        }
      )
    );
  });

  test("admit accepts a command exactly when admitEach accepts every one of its keys", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(kHeader, fc.subarray(kKeys)), { maxLength: 8 }),
        kHeader,
        fc.subarray(kKeys),
        (history, header, keys) => {
          const tracker = new ConflictTracker(new LastWriteWinsResolver());
          for (const [recorded, recordedKeys] of history) {
            tracker.record(recorded, recordedKeys);
          }

          const admitted = tracker.admit(header, keys) !== null;
          const partial = tracker.admitEach(header, keys);

          assert.strictEqual(admitted, partial.indices.length === keys.length);
        }
      )
    );
  });
});
