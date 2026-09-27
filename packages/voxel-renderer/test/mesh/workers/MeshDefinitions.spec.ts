// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockRegistry } from "../../../src/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../../src/blocks/shape/BlockShapeRegistry.ts";
import { TilesetManager } from "../../../src/tileset/TilesetManager.ts";
import { DefinedShape } from "../../../src/mesh/workers/DefinedShape.ts";
import { DefinedTilesets } from "../../../src/mesh/workers/DefinedTilesets.ts";
import {
  captureMeshDefinitions
} from "../../../src/mesh/workers/MeshDefinitions.ts";
import { FACES } from "../../../src/utils/math.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../../helpers/atlas.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import { CUBE_ID } from "../../helpers/ids.ts";

function makeSources() {
  const tilesetManager = new TilesetManager();
  registerAtlas(tilesetManager);
  tilesetManager.tilesets.add(makeAtlasDef({ id: "pending" }));

  return {
    blockRegistry: new BlockRegistry([makeBlockDef(CUBE_ID, "cube")]),
    shapeRegistry: BlockShapeRegistry.createDefault(),
    tilesetManager,
    alphaTest: 0.25
  };
}

describe("captureMeshDefinitions", () => {
  it("survives a structured clone", () => {
    const definitions = captureMeshDefinitions(makeSources());

    assert.deepEqual(structuredClone(definitions), definitions);
    assert.equal(definitions.alphaTest, 0.25);
    assert.deepEqual(definitions.blocks.map(({ id }) => id), [CUBE_ID]);
  });

  it("keeps the occlusion of every shape", () => {
    const { shapeRegistry } = makeSources();
    const { shapes } = captureMeshDefinitions(makeSources());

    for (const definition of shapes) {
      const shape = shapeRegistry.get(definition.id)!;
      const defined = new DefinedShape(structuredClone(definition));

      assert.deepEqual(
        FACES.map((face) => defined.occludes(face)),
        FACES.map((face) => shape.occludes(face)),
        definition.id
      );
      assert.deepEqual(defined.faces, shape.faces);
    }
  });
});

describe("DefinedTilesets", () => {
  it("resolves tilesets like the TilesetManager it was captured from", () => {
    const sources = makeSources();
    const { tilesets } = captureMeshDefinitions(sources);
    const defined = new DefinedTilesets(structuredClone(tilesets));

    for (const id of [undefined, "atlas", "pending", "unknown"]) {
      const expected = sources.tilesetManager.resolve(id);
      const actual = defined.resolve(id);

      assert.deepEqual(actual?.def, expected?.def, String(id));
      assert.deepEqual(actual?.uvFor(1, 2), expected?.uvFor(1, 2), String(id));
    }
  });
});
