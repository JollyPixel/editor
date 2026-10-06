// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockRegistry } from "../../../src/document/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../../src/document/blocks/shape/BlockShapeRegistry.ts";
import { BlocksetAtlases } from "../../../src/view/atlases/BlocksetAtlases.ts";
import { DefinedShape } from "../../../src/view/workers/DefinedShape.ts";
import { DefinedBlocksets } from "../../../src/view/workers/DefinedBlocksets.ts";
import {
  captureMeshDefinitions
} from "../../../src/view/workers/MeshDefinitions.ts";
import { FACES } from "../../../src/document/geometry/faceDirection.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../../helpers/atlas.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";
import { CUBE_ID } from "../../helpers/ids.ts";

function makeSources() {
  const atlases = new BlocksetAtlases();
  registerAtlas(atlases);
  atlases.blocksets.add(makeAtlasDef({ id: "pending" }));

  return {
    blockRegistry: new BlockRegistry([makeBlockDef(CUBE_ID, "cube")]),
    shapeRegistry: BlockShapeRegistry.createDefault(),
    atlases,
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

describe("DefinedBlocksets", () => {
  it("resolves blocksets like the BlocksetAtlases it was captured from", () => {
    const sources = makeSources();
    const { blocksets } = captureMeshDefinitions(sources);
    const defined = new DefinedBlocksets(structuredClone(blocksets));

    for (const id of [undefined, "atlas", "pending", "unknown"]) {
      const expected = sources.atlases.resolve(id);
      const actual = defined.resolve(id);

      assert.deepEqual(actual?.def, expected?.def, String(id));
      assert.deepEqual(actual?.uvFor(1, 2), expected?.uvFor(1, 2), String(id));
    }
  });
});
