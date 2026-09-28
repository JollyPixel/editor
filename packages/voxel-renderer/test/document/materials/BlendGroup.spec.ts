// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlendGroup,
  BlendGroupList
} from "../../../src/document/materials/index.ts";

describe("BlendGroup", () => {
  it("fills the defaults, drops duplicate exclusions and freezes itself", () => {
    const group = new BlendGroup({ id: "grass", exclude: ["sand", "sand"] });

    assert.deepEqual(group.toJSON(), {
      id: "grass",
      width: 8,
      pattern: "noise",
      priority: 0,
      exclude: ["sand"]
    });
    assert.ok(Object.isFrozen(group));
    assert.ok(Object.isFrozen(group.exclude));
  });

  it("rejects invalid settings", () => {
    const invalid = [
      { id: "" },
      { id: "a", width: 0 },
      { id: "a", width: 65 },
      { id: "a", width: 1.5 },
      { id: "a", pattern: "blur" },
      { id: "a", priority: 0.5 },
      { id: "a", exclude: "sand" },
      { id: "a", exclude: [""] }
    ];
    for (const json of invalid) {
      assert.throws(() => new BlendGroup(json as never), RangeError);
      assert.equal(BlendGroup.parse(json), null);
    }
    assert.equal(BlendGroup.parse(null), null);
  });

  describe("bleedOnto", () => {
    const cases: {
      name: string;
      bleeding: ConstructorParameters<typeof BlendGroup>[0];
      face: ConstructorParameters<typeof BlendGroup>[0];
      strength: number;
    }[] = [
      {
        name: "shares the edge with an equal group",
        bleeding: { id: "grass" },
        face: { id: "dirt" },
        strength: 0.5
      },
      {
        name: "never bleeds onto its own group",
        bleeding: { id: "grass" },
        face: { id: "grass" },
        strength: 0
      },
      {
        name: "covers a lower group",
        bleeding: { id: "grass", priority: 2 },
        face: { id: "dirt", priority: 1 },
        strength: 1
      },
      {
        name: "stays off a higher group",
        bleeding: { id: "dirt", priority: 1 },
        face: { id: "grass", priority: 2 },
        strength: 0
      },
      {
        name: "honours its own exclusion",
        bleeding: { id: "grass", exclude: ["sand"] },
        face: { id: "sand" },
        strength: 0
      },
      {
        name: "honours the face group's exclusion",
        bleeding: { id: "sand" },
        face: { id: "grass", exclude: ["sand"] },
        strength: 0
      }
    ];

    for (const { name, bleeding, face, strength } of cases) {
      it(name, () => {
        assert.equal(
          new BlendGroup(bleeding).bleedOnto(new BlendGroup(face)),
          strength
        );
      });
    }
  });

  it("derives a copy with changed settings", () => {
    const group = new BlendGroup({ id: "grass", exclude: ["sand"] });
    const wide = group.with({ width: 12 });

    assert.equal(wide.id, "grass");
    assert.equal(wide.width, 12);
    assert.deepEqual(wide.exclude, ["sand"]);
    assert.ok(!group.equals(wide));
    assert.ok(!group.equals(group.with({ exclude: ["snow"] })));
    assert.ok(wide.equals(new BlendGroup(wide.toJSON())));
  });
});

describe("BlendGroupList", () => {
  it("returns a normalized command and ignores a no-op definition", () => {
    const list = new BlendGroupList();
    const command = {
      action: "blend-group-defined",
      group: { id: "grass" }
    } as const;

    assert.deepEqual(list.apply(command), {
      action: "blend-group-defined",
      group: new BlendGroup({ id: "grass" }).toJSON()
    });
    assert.equal(list.apply(command), null);
    assert.equal(list.apply({
      action: "blend-group-defined",
      group: { id: "grass", width: 0 }
    }), null);
    assert.deepEqual(
      list.apply({ action: "blend-group-removed", groupId: "grass" }),
      { action: "blend-group-removed", groupId: "grass" }
    );
    assert.equal(list.size, 0);
  });
});
