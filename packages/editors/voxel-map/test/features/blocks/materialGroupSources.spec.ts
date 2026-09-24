// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  MaterialGroup,
  MaterialGroupList
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  customFinishSource,
  materialFinishSource,
  materialGroupNameOf,
  type MaterialGroupPort
} from "../../../src/features/blocks/materialGroupSources.ts";

interface FakePort extends MaterialGroupPort {
  groups: MaterialGroupList;
  writes: number;
}

function makePort(
  groupId: string | undefined,
  groups = new MaterialGroupList()
): FakePort {
  const port: FakePort = {
    groups,
    writes: 0,
    groupId: () => groupId,
    group: () => (groupId === undefined ? undefined : groups.get(groupId)),
    define: (group) => {
      port.writes++;
      groups.define(group);
    },
    remove: (id) => {
      port.writes++;
      groups.remove(id);
    }
  };

  return port;
}

describe("materialGroupNameOf", () => {
  it("trims the name and reads blank as no group", () => {
    assert.equal(materialGroupNameOf("  gold "), "gold");
    assert.equal(materialGroupNameOf("   "), undefined);
  });
});

describe("customFinishSource", () => {
  it("defines the block group with the default finish, then removes it", () => {
    const port = makePort("gold");
    const source = customFinishSource(port);

    assert.equal(source.read(), false);
    source.write(true, true);
    assert.equal(source.read(), true);
    assert.ok(port.groups.get("gold")?.equals(new MaterialGroup({ id: "gold" })));

    source.write(false, true);
    assert.equal(port.groups.has("gold"), false);
  });

  it("writes nothing without a group name or when the state already matches", () => {
    const ungrouped = makePort(undefined);
    customFinishSource(ungrouped).write(true, true);
    assert.equal(ungrouped.writes, 0);

    const port = makePort("gold", new MaterialGroupList([{ id: "gold" }]));
    customFinishSource(port).write(true, true);
    assert.equal(port.writes, 0);
  });
});

describe("materialFinishSource", () => {
  it("reads the defaults for a group the map does not define", () => {
    const port = makePort("gold");

    assert.equal(materialFinishSource(port, "roughness").read(), 1);
    assert.equal(materialFinishSource(port, "emissive").read(), "#000000");

    materialFinishSource(port, "metalness").write(1, true);
    assert.equal(port.writes, 0);
  });

  it("redefines the group with the edited field only", () => {
    const port = makePort("gold", new MaterialGroupList([
      { id: "gold", roughness: 0.4 }
    ]));

    materialFinishSource(port, "metalness").write(1, false);
    materialFinishSource(port, "emissive").write("#FF0000", true);

    assert.deepEqual(port.groups.get("gold")?.toJSON(), {
      id: "gold",
      roughness: 0.4,
      metalness: 1,
      emissive: "#ff0000",
      emissiveIntensity: 1
    });
  });

  it("drops an out of range or unchanged value", () => {
    const port = makePort("gold", new MaterialGroupList([{ id: "gold" }]));

    materialFinishSource(port, "metalness").write(2, true);
    materialFinishSource(port, "roughness").write(1, true);

    assert.equal(port.writes, 0);
  });
});
