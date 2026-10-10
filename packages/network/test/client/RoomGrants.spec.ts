// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CapabilityTable,
  RoomGrants,
  type Grants
} from "#src/index.ts";
import { RoomHarness } from "../helpers/client/RoomHarness.ts";

// CONSTANTS
const kTable = new CapabilityTable({
  stroke: "pixels",
  fill: "pixels",
  "palette-changed": "palette"
});

type Capability = "pixels" | "palette";

function granted(
  grants: Grants<Capability>
): Capability[] {
  return (["pixels", "palette"] as const).filter(
    (capability) => grants.has(capability)
  );
}

function setup() {
  const harness = new RoomHarness();
  const grants = new RoomGrants(harness.room, kTable);
  const changes: Capability[][] = [];
  const denied: string[] = [];
  grants.on("change", (next) => changes.push(granted(next)));
  grants.on("denied", (event) => denied.push(event));

  return {
    harness,
    grants,
    changes,
    denied
  };
}

describe("CapabilityTable", () => {
  test("withholds a capability when any of its events is not writable", () => {
    const grants = kTable.grantsFor({
      can: (event) => (event === "fill" ? "read" : "write")
    });

    assert.deepEqual(granted(grants), ["palette"]);
    assert.equal(grants.readOnly, false);
  });

  test("grants nothing to a role that only reads", () => {
    const grants = kTable.grantsFor({
      can: () => "read"
    });

    assert.equal(grants.readOnly, true);
    assert.equal(grants.equals(kTable.none), true);
    assert.equal(kTable.full.equals(kTable.none), false);
  });
});

describe("RoomGrants", () => {
  test("grants everything until the room admits this client", () => {
    const { grants, harness, changes } = setup();

    assert.equal(grants.current.equals(kTable.full), true);

    harness.admit("A", {}, {
      stroke: "write",
      fill: "write",
      "palette-changed": "read"
    });

    assert.deepEqual(granted(grants.current), ["pixels"]);
    assert.deepEqual(changes, [["pixels"]]);
  });

  test("emits change only when a sync alters the grants", () => {
    const { harness, changes } = setup();
    const rights = {
      stroke: "write",
      fill: "write",
      "palette-changed": "write"
    } as const;

    harness.admit("A", {}, rights);
    harness.admit("A", {}, rights);
    harness.admit("A", {}, {
      ...rights,
      stroke: "read"
    });

    assert.deepEqual(changes, [["palette"]]);
  });

  test("forwards refusals of the events its table governs", () => {
    const { harness, denied } = setup();

    harness.deny("$presence");
    harness.deny("fill");

    assert.deepEqual(denied, ["fill"]);
  });

  test("stops following the room once disposed", () => {
    const { harness, grants, changes, denied } = setup();

    grants.dispose();
    harness.admit("A");
    harness.deny("stroke");

    assert.deepEqual(changes, []);
    assert.deepEqual(denied, []);
  });
});
