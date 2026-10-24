// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  Ramp
} from "@jolly-pixel/voxel.renderer";
import { hasIcon } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { ShapeChoices } from "../../../../src/features/blocks/shapes/ShapeChoices.ts";

describe("ShapeChoices", () => {
  it("names every built-in shape and gives each one an icon", () => {
    const { options } = new ShapeChoices(BlockShapeRegistry.createDefault());

    assert.equal(options.length, 34);
    assert.ok(options.every((option) => option.group !== "Custom"));
    assert.ok(options.every((option) => option.label !== option.value));
    assert.ok(options.every((option) => hasIcon(option.icon!)));
    assert.deepEqual(
      options.find((option) => option.value === "poleCornerUp"),
      {
        value: "poleCornerUp",
        label: "Pole corner, rising",
        group: "Pole",
        icon: "block-shape-poleCornerUp"
      }
    );
  });

  it("orders groups block, wall, ramp, stair, pole and pairs each pole junction by rise", () => {
    const { options } = new ShapeChoices(BlockShapeRegistry.createDefault());

    assert.deepEqual(
      [...new Set(options.map((option) => option.group))],
      ["Block", "Wall", "Ramp", "Stair", "Pole"]
    );
    assert.deepEqual(
      options.filter((option) => option.group === "Pole").slice(6, 9).map((option) => option.value),
      ["poleCorner", "poleCornerUp", "poleCornerThrough"]
    );
  });

  it("lists shapes without a name last, under Custom, in registry order", () => {
    const shapes = new BlockShapeRegistry().registerMany([
      new Ramp("second"),
      new Ramp("rampTip"),
      new Ramp("first"),
      new Ramp()
    ]);

    assert.deepEqual(
      new ShapeChoices(shapes).options.map((option) => [option.group, option.label]),
      [
        ["Ramp", "Ramp"],
        ["Ramp", "Ramp tip"],
        ["Custom", "second"],
        ["Custom", "first"]
      ]
    );
  });

  it("reuses the options until a shape is registered", () => {
    const shapes = BlockShapeRegistry.createDefault();
    const first = ShapeChoices.from(shapes);

    assert.equal(ShapeChoices.from(shapes), first);

    shapes.register(new Ramp("custom"));
    const next = ShapeChoices.from(shapes);

    assert.notEqual(next, first);
    assert.equal(next.options.at(-1)?.value, "custom");
  });
});
