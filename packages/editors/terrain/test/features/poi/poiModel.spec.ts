// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { PoiChunkDrag } from "#src/features/poi/model/PoiChunkDrag.ts";
import { PoiEditor } from "#src/features/poi/model/PoiEditor.ts";
import { PoiSelection } from "#src/features/poi/model/PoiSelection.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

function chunkCentre(
  x: number,
  z: number
) {
  return { x: (x + 0.5) * CHUNK_SAMPLES, z: (z + 0.5) * CHUNK_SAMPLES };
}

function poiSetup() {
  const document = new TerrainDocument();
  for (const x of [0, 1, 2]) {
    document.addChunk(x, 0);
  }
  const history = createTerrainHistory(document);
  const selection = new PoiSelection(document);
  const editor = new PoiEditor({ document, history, selection });

  return { document, history, selection, editor };
}

function chunkKeys(
  document: TerrainDocument,
  id: string
): string[] {
  return document.pointsOfInterest.pointOfInterest(id)!.chunks.map(({ x, z }) => `${x},${z}`);
}

describe("points of interest in the editor", () => {
  test("adding names each point apart and selects it; removing it ends its selection and editing", () => {
    const { document, history, selection, editor } = poiSetup();
    const first = editor.add()!;
    const second = editor.add()!;
    selection.edit(true);

    assert.deepEqual(
      document.pointsOfInterest.pointsOfInterest().map(({ name }) => name),
      ["Point of interest 1", "Point of interest 2"]
    );
    assert.deepEqual([selection.selected, selection.editing], [second, true]);

    editor.remove(second);
    assert.deepEqual([selection.selected, selection.editing], [null, false]);
    selection.edit(true);
    assert.equal(selection.editing, false);

    history.undo(TERRAIN_HISTORY_SCOPE);
    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual(document.pointsOfInterest.pointsOfInterest().map(({ id }) => id), [first]);
  });

  test("a chunk drag adds the known chunks it crosses, removes them in remove mode, each as one step", () => {
    const { document, history, editor } = poiSetup();
    const id = editor.add()!;

    const add = new PoiChunkDrag({ document, history }, { id, mode: "add" }, chunkCentre(0, 0));
    add.moveTo(chunkCentre(3, 0));
    add.end();
    assert.deepEqual(chunkKeys(document, id), ["0,0", "1,0", "2,0"]);

    const remove = new PoiChunkDrag({ document, history }, { id, mode: "remove" }, chunkCentre(1, 0));
    remove.end();
    assert.deepEqual(chunkKeys(document, id), ["0,0", "2,0"]);

    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual(chunkKeys(document, id), ["0,0", "1,0", "2,0"]);
    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual(chunkKeys(document, id), []);
  });
});
