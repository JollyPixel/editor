// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { MaterialSurface } from "#src/model/materials/MaterialSurface.ts";
import type { MaterialSurfaceJSON } from "#src/model/types.ts";

describe("MaterialSurface", () => {
  test("parse accepts only a complete surface within its bounds", () => {
    const cases: ReadonlyArray<readonly [unknown, boolean]> = [
      [MaterialSurface.create(), true],
      [MaterialSurface.create({ opacity: 0, emissiveIntensity: 7 }), true],
      [MaterialSurface.create({ opacity: 1.5 }), false],
      [MaterialSurface.create({ roughness: -0.1 }), false],
      [MaterialSurface.create({ metalness: 2 }), false],
      [MaterialSurface.create({ emissiveIntensity: -1 }), false],
      [MaterialSurface.create({ color: "red" }), false],
      [MaterialSurface.create({ color: "#ABCDEF" }), false],
      [MaterialSurface.create({ emissive: "#fff" }), false],
      [{ ...MaterialSurface.create(), opacity: "1" }, false],
      [{ color: "#ffffff" }, false],
      [null, false],
      ["#ffffff", false]
    ];

    for (const [value, expected] of cases) {
      assert.equal(MaterialSurface.parse(value) !== undefined, expected, JSON.stringify(value));
    }
  });

  test("parsePatch accepts one or more known fields within their bounds", () => {
    const cases: ReadonlyArray<readonly [unknown, boolean]> = [
      [{ roughness: 0.2 }, true],
      [{ emissive: "#ff0000", emissiveIntensity: 3 }, true],
      [MaterialSurface.create(), true],
      [{ opacity: 2 }, false],
      [{ shine: 1 }, false],
      [{ color: "#ffffff", shine: 1 }, false],
      [{}, false],
      [null, false]
    ];

    for (const [value, expected] of cases) {
      assert.equal(MaterialSurface.parsePatch(value) !== undefined, expected, JSON.stringify(value));
    }
  });

  test("glows only with a non-black emissive color at a positive intensity", () => {
    function glowsWith(
      overrides: Partial<MaterialSurfaceJSON>
    ): boolean {
      return MaterialSurface.glows(MaterialSurface.create(overrides));
    }

    assert.equal(glowsWith({ emissive: "#ffcc66" }), true);
    assert.equal(glowsWith({ emissive: "#ffcc66", emissiveIntensity: 0 }), false);
    assert.equal(glowsWith({}), false);
  });

  test("tells whether it already holds every field of a patch", () => {
    const surface = new MaterialSurface(MaterialSurface.create({ opacity: 0.5 }));

    assert.equal(surface.holds({ opacity: 0.5 }), true);
    assert.equal(surface.holds({ opacity: 0.5, roughness: 0.2 }), false);
  });

  test("lists the fields another surface changes", () => {
    const json = MaterialSurface.create();
    const surface = new MaterialSurface(json);

    assert.deepEqual(surface.changesTo({ ...json }), {});
    assert.deepEqual(
      surface.changesTo({ ...json, opacity: 0.5, emissive: "#ff0000" }),
      { opacity: 0.5, emissive: "#ff0000" }
    );
  });
});
