// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { BlockLightField } from "../../../src/view/lighting/BlockLightField.ts";
import { lightChunkKey } from "../../../src/view/lighting/LightGrid.ts";
import {
  LIGHT_OPAQUE,
  lightChannel
} from "../../../src/view/lighting/packedLight.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import { clearAllDirty } from "../../helpers/world.ts";
import {
  GLASS_ID,
  GLOW_ID,
  litWorld,
  SLAB_ID,
  STONE_ID
} from "../../helpers/lighting/litWorld.ts";

function cellAt(
  field: BlockLightField,
  x: number,
  y: number,
  z: number
): number {
  const row = new Uint16Array(1);
  field.copyRow(x, y, z, row);

  return row[0];
}

function rgbAt(
  field: BlockLightField,
  x: number,
  y = 0,
  z = 0
): [number, number, number] {
  const cell = cellAt(field, x, y, z);

  return [lightChannel(cell, 0), lightChannel(cell, 1), lightChannel(cell, 2)];
}

function levelAt(
  field: BlockLightField,
  x: number,
  y = 0,
  z = 0
): number {
  return rgbAt(field, x, y, z)[0];
}

describe("BlockLightField", () => {
  it("spreads one level per cell across chunk borders", () => {
    const { field, place } = litWorld();
    place({ x: 2, y: 0, z: 0 }, GLOW_ID);

    field.update();

    assert.equal(levelAt(field, 2), 15);
    assert.equal(levelAt(field, 3), 14);
    assert.equal(levelAt(field, 2, 5, 0), 10);
    assert.equal(levelAt(field, -3), 10);
    assert.equal(levelAt(field, 16), 1);
    assert.equal(levelAt(field, 17), 0);
  });

  it("reaches as far through small chunks", () => {
    const { field, place } = litWorld({ chunkSize: 4 });
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);

    field.update();

    assert.equal(levelAt(field, 13), 2);
    assert.equal(levelAt(field, 0, 0, -14), 1);
    assert.equal(levelAt(field, 0, 0, -15), 0);
  });

  it("goes around opaque blocks but through slabs and glass", () => {
    const { field, place } = litWorld();
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    place({ x: 2, y: 0, z: 0 }, STONE_ID);
    place({ x: 0, y: 0, z: 2 }, SLAB_ID);
    place({ x: 0, y: 2, z: 0 }, GLASS_ID);

    field.update();

    assert.equal(cellAt(field, 2, 0, 0), LIGHT_OPAQUE);
    assert.equal(levelAt(field, 3), 10);
    assert.equal(levelAt(field, 0, 0, 3), 12);
    assert.equal(levelAt(field, 0, 3, 0), 12);
  });

  it("tints the light with the emissive hue", () => {
    const { field, place } = litWorld({
      glow: {
        lightLevel: 12,
        emissive: "#ff8000"
      }
    });
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);

    field.update();

    assert.deepEqual(rgbAt(field, 0), [12, 8, 0]);
    assert.deepEqual(rgbAt(field, 3), [9, 5, 0]);
  });

  it("keeps the brightest channel where two lights meet", () => {
    const { document, field, place } = litWorld({
      glow: {
        lightLevel: 15,
        emissive: "#ff0000"
      }
    });
    document.defineMaterialGroup({
      id: "blue",
      lightLevel: 15,
      emissive: "#0000ff"
    });
    document.defineBlock(makeBlockDef(5, "cube", { materialGroup: "blue" }));
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    place({ x: 6, y: 0, z: 0 }, 5);

    field.update();

    assert.deepEqual(rgbAt(field, 2), [13, 0, 11]);
  });

  it("relights the region around an edit and reports the changed chunks", () => {
    const { field, place, remove } = litWorld();
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    field.update();

    place({ x: 1, y: 0, z: 0 }, STONE_ID);
    const walled = field.update();

    assert.ok(walled.has(lightChunkKey(0, 0, 0)));
    assert.equal(levelAt(field, 2), 11);

    remove({ x: 0, y: 0, z: 0 });
    const dark = field.update();

    assert.ok(dark.has(lightChunkKey(-1, 0, 0)));
    assert.equal(levelAt(field, -1), 0);
    assert.equal(levelAt(field, 2), 0);
  });

  it("reports every lit chunk once after a repaint, without relighting", () => {
    const { field, place } = litWorld();
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    const lit = field.update();
    const before = levelAt(field, 3);

    field.repaint();

    assert.deepEqual([...field.update()].sort(), [...lit].sort());
    assert.equal(levelAt(field, 3), before);
    assert.equal(field.update().size, 0);
  });

  it("copies a box across chunk borders cell by cell like rows", () => {
    const { field, place } = litWorld({ chunkSize: 4 });
    place({ x: 1, y: 1, z: 1 }, GLOW_ID);
    place({ x: 3, y: 1, z: 1 }, STONE_ID);
    field.update();
    const span = 7;
    const box = new Uint16Array(span ** 3);

    field.copyBox(-2, -1, -3, span, box);

    const row = new Uint16Array(span);
    for (let z = 0; z < span; z++) {
      for (let y = 0; y < span; y++) {
        field.copyRow(-2, y - 1, z - 3, row);
        const offset = (y + (z * span)) * span;
        assert.deepEqual([...box.subarray(offset, offset + span)], [...row]);
      }
    }
    assert.ok(box.some((cell) => (cell & LIGHT_OPAQUE) !== 0));
  });

  it("reports nothing for edits out of reach of any light", () => {
    const { field, place } = litWorld();
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    field.update();

    place({ x: 100, y: 0, z: 0 }, STONE_ID);

    assert.equal(field.update().size, 0);
    assert.equal(field.update().size, 0);
  });

  it("notices writes without a command once their chunk turns dirty again", () => {
    const { document, field, place } = litWorld();
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    field.update();
    clearAllDirty(document.world);

    document.world.silently(
      () => document.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } })
    );
    field.update();

    assert.equal(levelAt(field, 1), 0);
  });

  it("lights nothing until a group gains a light level", () => {
    const { document, sources, field, place } = litWorld({
      glow: { lightLevel: 0 }
    });
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    assert.equal(field.update().size, 0);

    document.defineMaterialGroup({ id: "glow", lightLevel: 8 });
    sources.refresh();
    field.invalidate();
    const changed = field.update();

    assert.ok(changed.has(lightChunkKey(0, 0, 0)));
    assert.equal(levelAt(field, 1), 7);
  });

  it("darkens when the light's layer is hidden or removed", () => {
    const { document, field, place, visibility } = litWorld({
      layers: ["Ground", "Lamps"]
    });
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    document.world.setVoxel("Lamps", {
      position: { x: 0, y: 4, z: 0 },
      blockId: GLOW_ID
    });
    field.update();

    visibility.override("Ground", false);
    field.update();
    assert.equal(levelAt(field, 1), 10);

    document.world.removeLayer("Lamps");
    field.update();
    assert.equal(levelAt(field, 1), 0);
  });

  it("follows the layer position", () => {
    const { document, field, place } = litWorld();
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    field.update();

    document.world.setLayerPosition("Ground", { x: 5, y: 0, z: 0 });
    field.update();

    assert.equal(levelAt(field, 5), 15);
    assert.equal(levelAt(field, 7), 13);
    assert.equal(levelAt(field, 0), 10);
  });
});
