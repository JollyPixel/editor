// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  PORTS,
  baseUrl,
  socketUrl
} from "../src/ports.ts";

describe("PORTS", () => {
  it("gives every suite its own port", () => {
    const ports = Object.values(PORTS);

    assert.equal(new Set(ports).size, ports.length);
  });

  it("builds the page and sync socket URLs of a port", () => {
    assert.equal(baseUrl(PORTS.ui), "http://localhost:3001");
    assert.equal(socketUrl(PORTS.voxelMap), "ws://localhost:3002/ws-sync");
  });
});
