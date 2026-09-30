// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ReplayBasis } from "#src/network/client.ts";

describe("ReplayBasis", () => {
  test("answers the version learned for an origin timestamp", () => {
    const basis = new ReplayBasis();

    basis.learn(100, 7);
    basis.learn(100, 9);
    basis.learn(200, undefined);

    assert.strictEqual(basis.of(100), 9);
    assert.strictEqual(basis.of(undefined), undefined);
  });

  test("answers 0 for a replay whose original it never saw acknowledged", () => {
    assert.strictEqual(new ReplayBasis().of(200), 0);
  });

  test("forgets the oldest timestamps past its bound", () => {
    const basis = new ReplayBasis();
    for (let timestamp = 0; timestamp < 600; timestamp++) {
      basis.learn(timestamp, timestamp + 1);
    }

    assert.strictEqual(basis.of(0), 0);
    assert.strictEqual(basis.of(599), 600);
  });
});
