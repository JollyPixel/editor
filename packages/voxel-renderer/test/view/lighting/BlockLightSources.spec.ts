// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockRegistry } from "../../../src/document/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../../src/document/blocks/shape/BlockShapeRegistry.ts";
import { MaterialGroupList } from "../../../src/document/materials/index.ts";
import { BlockLightSources } from "../../../src/view/lighting/BlockLightSources.ts";
import { LightFalloff } from "../../../src/view/lighting/LightFalloff.ts";
import {
  grayLight,
  packLight
} from "../../../src/view/lighting/packedLight.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";

function makeSources(): {
  sources: BlockLightSources;
  blocks: BlockRegistry;
  materialGroups: MaterialGroupList;
} {
  const blocks = new BlockRegistry([
    makeBlockDef(1, "cube"),
    makeBlockDef(2, "slab"),
    makeBlockDef(3, "cube", { alphaMode: "mask" }),
    makeBlockDef(4, "cube", { materialGroup: "lava" }),
    makeBlockDef(5, "cube", { materialGroup: "lamp" })
  ]);
  const materialGroups = new MaterialGroupList([
    { id: "lava", lightLevel: 10, emissive: "#ff8000" },
    { id: "lamp", lightLevel: 15 }
  ]);

  return {
    blocks,
    materialGroups,
    sources: new BlockLightSources({
      blocks,
      shapes: BlockShapeRegistry.createDefault(),
      materialGroups
    })
  };
}

describe("BlockLightSources", () => {
  it("blocks light with opaque full cubes only", () => {
    const { sources } = makeSources();

    assert.equal(sources.isOpaque(1), true);
    assert.equal(sources.isOpaque(2), false);
    assert.equal(sources.isOpaque(3), false);
    assert.equal(sources.isOpaque(99), false);
  });

  it("emits the group light level in its emissive hue, white when black", () => {
    const { sources } = makeSources();

    assert.equal(sources.emissionOf(1), 0);
    assert.equal(sources.emissionOf(4), packLight(10, 6, 0));
    assert.equal(sources.emissionOf(5), grayLight(15));
    assert.equal(sources.emits, true);
  });

  it("reports whether a refresh changed what the blocks emit or block", () => {
    const { sources, materialGroups } = makeSources();
    assert.equal(sources.emits, true);

    materialGroups.define({ id: "lava", lightLevel: 10, emissive: "#ff8000", roughness: 0.2 });
    assert.equal(sources.refresh(), false);

    materialGroups.define({ id: "lava" });
    materialGroups.define({ id: "lamp" });
    assert.equal(sources.refresh(), true);

    assert.equal(sources.emissionOf(4), 0);
    assert.equal(sources.emits, false);
  });

  it("reports whether a new falloff changes what tinted blocks emit", () => {
    const { sources } = makeSources();
    const lava = sources.emissionOf(4);

    assert.equal(sources.switchFalloff(LightFalloff.WIDE), false);
    assert.equal(sources.switchFalloff(LightFalloff.FOCUSED), true);
    assert.equal(sources.falloff, LightFalloff.FOCUSED);
    assert.notEqual(sources.emissionOf(4), lava);
    assert.equal(sources.emissionOf(5), grayLight(15));
  });
});
