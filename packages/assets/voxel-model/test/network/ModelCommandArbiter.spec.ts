// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelCommandArbiter } from "#src/network/ModelCommandArbiter.ts";
import type { ModelNetworkCommand } from "#src/network/types.ts";

const kTransform = {
  position: { x: 0, y: 0, z: 0 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

function admitted(
  arbiter: ModelCommandArbiter,
  command: ModelNetworkCommand
): ModelNetworkCommand | null {
  return arbiter.admit(command)?.command ?? null;
}

function commit(
  arbiter: ModelCommandArbiter,
  command: ModelNetworkCommand
): void {
  arbiter.admit(command)!.commit();
}

type TransformedCommand = Extract<ModelNetworkCommand, { action: "group-transformed"; }>;

function transformedCmd(
  overrides: Partial<Omit<TransformedCommand, "action">> = {}
): TransformedCommand {
  return {
    action: "group-transformed",
    uuid: "group-1",
    transform: kTransform,
    clientId: "client-A",
    seq: 1,
    timestamp: 1000,
    ...overrides
  };
}

describe("ModelCommandArbiter.key", () => {
  it("keys group-transformed, group-renamed, group-reparented(-local) by uuid", () => {
    assert.equal(
      ModelCommandArbiter.key(transformedCmd()),
      "group:group-1"
    );
    assert.equal(
      ModelCommandArbiter.key({
        action: "group-renamed",
        uuid: "group-1",
        name: "X",
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      "group:group-1"
    );
    assert.equal(
      ModelCommandArbiter.key({
        action: "group-reparented",
        uuid: "group-1",
        parentUuid: null,
        transform: kTransform,
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      "group:group-1"
    );
    assert.equal(
      ModelCommandArbiter.key({
        action: "group-reparented-local",
        uuid: "group-1",
        parentUuid: null,
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      "group:group-1"
    );
  });

  it("does not key group-added or group-removed (unarbitrated)", () => {
    assert.equal(
      ModelCommandArbiter.key({
        action: "group-added",
        uuid: "group-1",
        name: "X",
        transform: kTransform,
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      null
    );
    assert.equal(
      ModelCommandArbiter.key({
        action: "group-removed",
        uuid: "group-1",
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      null
    );
  });
});

describe("ModelCommandArbiter.admit / commit", () => {
  it("accepts the first command for a key", () => {
    const arbiter = new ModelCommandArbiter();
    const cmd = transformedCmd();

    assert.equal(admitted(arbiter, cmd), cmd);
  });

  it("accepts a later timestamp and rejects an earlier one, per uuid", () => {
    const arbiter = new ModelCommandArbiter();
    const first = transformedCmd({ clientId: "A", timestamp: 900 });
    const later = transformedCmd({ clientId: "B", timestamp: 1500 });
    const stale = transformedCmd({ clientId: "C", timestamp: 500 });

    assert.notEqual(admitted(arbiter, first), null);
    commit(arbiter, first);

    assert.notEqual(admitted(arbiter, later), null);
    commit(arbiter, later);

    assert.equal(admitted(arbiter, stale), null);
  });

  it("never conflicts across different uuids", () => {
    const arbiter = new ModelCommandArbiter();
    const groupA = transformedCmd({ uuid: "a", clientId: "A", timestamp: 900 });
    commit(arbiter, groupA);

    const groupB = transformedCmd({ uuid: "b", clientId: "B", timestamp: 100 });

    assert.notEqual(admitted(arbiter, groupB), null);
  });

  it("always admits unarbitrated actions regardless of prior state", () => {
    const arbiter = new ModelCommandArbiter();
    const removed: ModelNetworkCommand = {
      action: "group-removed",
      uuid: "group-1",
      clientId: "A",
      seq: 1,
      timestamp: 1
    };

    assert.notEqual(admitted(arbiter, removed), null);
    commit(arbiter, removed);
    assert.notEqual(admitted(arbiter, removed), null);
  });
});
