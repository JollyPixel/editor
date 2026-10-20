// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { BenchmarkError } from "../../src/errors/index.ts";
import { batched } from "../../src/suite/batched.ts";
import { defineSuite } from "../../src/suite/suite.ts";
import { fastConfig } from "../helpers/config.ts";

describe("batched", () => {
  it("should call the body the configured batch size per iteration", async() => {
    let calls = 0;
    const suite = defineSuite("unit / batch size", (bench) => {
      bench.add("task", batched(() => {
        calls++;
      }));
    });

    await suite.run(fastConfig({ batch: 7 }));

    assert.ok(calls > 0);
    assert.equal(calls % 7, 0);
  });

  it("should refuse to run outside a defineSuite() bench", () => {
    const task = batched(() => void 0);

    assert.throws(task, BenchmarkError);
  });
});
