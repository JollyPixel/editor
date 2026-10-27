// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TerrainDocument,
  TerrainPreview,
  type TerrainCommand
} from "@jolly-pixel/asset.terrain/client";
import type { TerrainReader } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { PaintStroke } from "#src/features/paint/model/PaintStroke.ts";
import { COMMIT_INTERVAL } from "#src/features/sculpt/model/CommitCadence.ts";
import { SculptSettings } from "#src/features/sculpt/model/SculptSettings.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

// CONSTANTS
const kPoint = { x: 20, z: 20 };
const kSlot = 4;
const kFrame = 0.05;

function slotAt(
  terrain: TerrainReader
): number {
  return terrain.chunk([...terrain.chunks()][0].coord)!.splat.dominantSlot(kPoint.x * 2, kPoint.z * 2);
}

function strokeSetup() {
  const document = new TerrainDocument();
  document.addChunk(0, 0);
  const preview = new TerrainPreview(document);
  const history = createTerrainHistory(document);
  const settings = new SculptSettings();
  settings.update({ tool: "paint", size: 4, paintStrength: 1, falloff: "constant" });
  const committed: TerrainCommand[] = [];
  document.on("change", ({ command }) => {
    if (command.action === "splat-patched") {
      committed.push(command);
    }
  });

  return {
    document,
    preview,
    history,
    committed,
    press: () => new PaintStroke(
      { document, preview, history, settings },
      { point: kPoint, slot: kSlot }
    )
  };
}

describe("PaintStroke", () => {
  test("a held press shows its paint at once, and confirms it as one undo step on release", () => {
    const { document, preview, history, committed, press } = strokeSetup();
    const stroke = press();

    stroke.update(kPoint, kFrame);
    stroke.update({ x: kPoint.x + 2, z: kPoint.z }, kFrame);
    assert.equal(slotAt(preview.terrain), kSlot);
    assert.equal(slotAt(document.terrain), 0);

    stroke.end();
    assert.equal(slotAt(document.terrain), kSlot);
    assert.deepEqual(committed.map(({ action }) => action), ["splat-patched"]);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);

    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual([slotAt(document.terrain), slotAt(preview.terrain)], [0, 0]);
  });

  test("a long stroke confirms its paint every 2 s and still undoes as one step", () => {
    const { document, history, committed, press } = strokeSetup();
    const stroke = press();

    for (let elapsed = 0; elapsed <= COMMIT_INTERVAL; elapsed += kFrame) {
      stroke.update(kPoint, kFrame);
    }
    assert.equal(committed.length, 1);
    assert.equal(slotAt(document.terrain), kSlot);

    stroke.update({ x: kPoint.x + 10, z: kPoint.z }, kFrame);
    stroke.end();

    assert.equal(committed.length, 2);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);
  });
});
