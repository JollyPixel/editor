// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { configure, resetConfig } from "../src/config.ts";
import { batched } from "../src/suite.ts";

describe("batched", () => {
  afterEach(() => {
    resetConfig();
  });

  it("should call the body once per configured batch unit", () => {
    configure({ batch: 7 });
    let calls = 0;
    const task = batched(() => {
      calls++;
    });

    task();

    assert.equal(calls, 7);
  });

  it("should read the batch size at call time", () => {
    let calls = 0;
    const task = batched(() => {
      calls++;
    });

    configure({ batch: 3 });
    task();

    assert.equal(calls, 3);
  });
});
