// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MaterialGroup,
  MaterialGroupList
} from "../../../src/document/materials/index.ts";

describe("MaterialGroup", () => {
  it("fills the finish defaults and freezes itself", () => {
    const group = new MaterialGroup({ id: "gold" });

    assert.deepEqual(group.toJSON(), {
      id: "gold",
      roughness: 1,
      metalness: 0,
      emissive: "#000000",
      emissiveIntensity: 1,
      normalScale: 1,
      lightLevel: 0
    });
    assert.ok(Object.isFrozen(group));
  });

  it("normalizes the emissive colour to lower case", () => {
    assert.equal(
      new MaterialGroup({ id: "lava", emissive: "#FF8800" }).emissive,
      "#ff8800"
    );
  });

  it("glows only with a non-black emissive and a positive intensity", () => {
    assert.equal(new MaterialGroup({ id: "stone" }).glows, false);
    assert.equal(new MaterialGroup({ id: "lamp", lightLevel: 15 }).glows, false);
    assert.equal(new MaterialGroup({ id: "lava", emissive: "#FF8000" }).glows, true);
    assert.equal(
      new MaterialGroup({ id: "dim", emissive: "#ff8000", emissiveIntensity: 0 }).glows,
      false
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
      { id: "a", emissiveIntensity: Infinity },
      { id: "a", normalScale: -0.5 },
      { id: "a", normalScale: NaN },
      { id: "a", lightLevel: -1 },
      { id: "a", lightLevel: 16 },
      { id: "a", lightLevel: 7.5 }
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
      emissiveIntensity: 2,
      normalScale: 0.5
    }).applyMaterialFinish(material);

    assert.equal(material.roughness, 0.25);
    assert.equal(material.metalness, 1);
    assert.equal(material.emissive.getHexString(), "ff0000");
    assert.equal(material.emissiveIntensity, 2);
    assert.deepEqual(material.normalScale.toArray(), [0.5, 0.5]);
  });

  it("applies the emissive fields and normal scale to a lambert material", () => {
    const material = new THREE.MeshLambertMaterial();
    new MaterialGroup({
      id: "lava",
      emissive: "#00ff00",
      emissiveIntensity: 0.5,
      normalScale: 2
    }).applyMaterialFinish(material);

    assert.equal(material.emissive.getHexString(), "00ff00");
    assert.equal(material.emissiveIntensity, 0.5);
    assert.deepEqual(material.normalScale.toArray(), [2, 2]);
  });

  it("keeps an optional swatch colour out of the rendered finish", () => {
    const group = new MaterialGroup({ id: "gold", swatch: "#FFAA00" });
    const material = new THREE.MeshStandardMaterial();
    group.applyMaterialFinish(material);

    assert.equal(new MaterialGroup({ id: "gold" }).swatch, null);
    assert.equal(group.swatch, "#ffaa00");
    assert.equal(group.toJSON().swatch, "#ffaa00");
    assert.equal(material.color.getHexString(), "ffffff");
    assert.equal("swatch" in new MaterialGroup({ id: "gold" }).toJSON(), false);
  });

  it("treats the swatch as part of the definition", () => {
    const group = new MaterialGroup({ id: "gold", swatch: "#ffaa00" });
    const recoloured = group.with({ swatch: "#00aaff" });

    assert.equal(recoloured.swatch, "#00aaff");
    assert.equal(recoloured.with({ roughness: 0.5 }).swatch, "#00aaff");
    assert.ok(!group.equals(recoloured));
    assert.equal(MaterialGroup.parse({ id: "gold", swatch: "gold" }), null);
  });

  it("treats normal scale as part of the finish", () => {
    const group = new MaterialGroup({ id: "stone" });
    const flat = group.with({ normalScale: 0 });

    assert.equal(flat.normalScale, 0);
    assert.ok(!group.equals(flat));
  });

  it("keeps the light level through a copy and its JSON", () => {
    const group = new MaterialGroup({ id: "glowstone" });
    const lit = group.with({ lightLevel: 15 });

    assert.equal(group.lightLevel, 0);
    assert.equal(lit.lightLevel, 15);
    assert.ok(!group.equals(lit));
    assert.ok(lit.equals(new MaterialGroup(lit.toJSON())));
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

  it("applies commands, returning the parsed definition or null", () => {
    const list = new MaterialGroupList();

    assert.deepEqual(list.applyCommand({
      action: "material-group-defined",
      group: { id: "gold", metalness: 1 }
    }), {
      action: "material-group-defined",
      group: new MaterialGroup({ id: "gold", metalness: 1 }).toJSON()
    });
    assert.equal(list.applyCommand({
      action: "material-group-defined",
      group: { id: "bad", roughness: 4 }
    }), null);
    assert.equal(list.applyCommand({
      action: "material-group-removed",
      groupId: "missing"
    }), null);
    assert.notEqual(list.applyCommand({
      action: "material-group-removed",
      groupId: "gold"
    }), null);
    assert.equal(list.has("gold"), false);
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
