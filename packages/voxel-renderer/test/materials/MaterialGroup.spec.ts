// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MaterialGroup,
  MaterialGroupList
} from "../../src/materials/index.ts";

describe("MaterialGroup", () => {
  it("fills the finish defaults and freezes itself", () => {
    const group = new MaterialGroup({ id: "gold" });

    assert.deepEqual(group.toJSON(), {
      id: "gold",
      roughness: 1,
      metalness: 0,
      emissive: "#000000",
      emissiveIntensity: 1
    });
    assert.ok(Object.isFrozen(group));
  });

  it("normalizes the emissive colour to lower case", () => {
    assert.equal(
      new MaterialGroup({ id: "lava", emissive: "#FF8800" }).emissive,
      "#ff8800"
    );
  });

  it("rejects out of range values", () => {
    const invalid = [
      { id: "" },
      { id: "a", roughness: 1.5 },
      { id: "a", metalness: -0.1 },
      { id: "a", metalness: NaN },
      { id: "a", emissive: "red" },
      { id: "a", emissiveIntensity: -1 },
      { id: "a", emissiveIntensity: Infinity }
    ];
    for (const json of invalid) {
      assert.throws(() => new MaterialGroup(json), RangeError);
      assert.equal(MaterialGroup.parse(json), null);
    }
    assert.equal(MaterialGroup.parse("gold"), null);
    assert.equal(MaterialGroup.parse(null), null);
  });

  it("derives a copy with a changed finish", () => {
    const group = new MaterialGroup({ id: "gold", roughness: 0.3 });
    const metal = group.with({ metalness: 1 });

    assert.equal(metal.id, "gold");
    assert.equal(metal.roughness, 0.3);
    assert.equal(metal.metalness, 1);
    assert.equal(group.metalness, 0);
    assert.ok(!group.equals(metal));
    assert.ok(metal.equals(new MaterialGroup(metal.toJSON())));
  });

  it("applies every field to a standard material", () => {
    const material = new THREE.MeshStandardMaterial();
    new MaterialGroup({
      id: "gold",
      roughness: 0.25,
      metalness: 1,
      emissive: "#ff0000",
      emissiveIntensity: 2
    }).applyTo(material);

    assert.equal(material.roughness, 0.25);
    assert.equal(material.metalness, 1);
    assert.equal(material.emissive.getHexString(), "ff0000");
    assert.equal(material.emissiveIntensity, 2);
  });

  it("applies the emissive fields to a lambert material", () => {
    const material = new THREE.MeshLambertMaterial();
    new MaterialGroup({
      id: "lava",
      emissive: "#00ff00",
      emissiveIntensity: 0.5
    }).applyTo(material);

    assert.equal(material.emissive.getHexString(), "00ff00");
    assert.equal(material.emissiveIntensity, 0.5);
  });
});

describe("MaterialGroupList", () => {
  it("reports whether a definition changed the list", () => {
    const list = new MaterialGroupList();
    const version = list.version;

    assert.equal(list.define({ id: "gold", metalness: 1 }), true);
    assert.equal(list.define({ id: "gold", metalness: 1 }), false);
    assert.equal(list.define({ id: "gold", metalness: 2 }), false);
    assert.equal(list.version, version + 1);
    assert.equal(list.define(new MaterialGroup({ id: "gold" })), true);
    assert.equal(list.get("gold")?.metalness, 0);
  });

  it("removes a group once", () => {
    const list = new MaterialGroupList([{ id: "gold" }]);

    assert.equal(list.remove("gold"), true);
    assert.equal(list.remove("gold"), false);
    assert.equal(list.size, 0);
  });

  it("skips invalid and duplicate entries on replace", () => {
    const list = new MaterialGroupList([
      { id: "gold", metalness: 1 },
      { id: "gold", metalness: 0.5 },
      { id: "bad", roughness: 4 },
      42
    ]);

    assert.deepEqual([...list.ids()], ["gold"]);
    assert.equal(list.get("gold")?.metalness, 1);
    assert.deepEqual(list.toJSON(), [new MaterialGroup({
      id: "gold",
      metalness: 1
    }).toJSON()]);
  });
});
