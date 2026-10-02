// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { PORTS } from "../src/ports.ts";

describe("PORTS", () => {
  it("gives every suite its own port", () => {
    const ports = Object.values(PORTS);

    assert.equal(new Set(ports).size, ports.length);
  });
});
