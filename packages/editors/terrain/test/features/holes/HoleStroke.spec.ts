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
import { HoleStroke } from "#src/features/holes/model/HoleStroke.ts";
import { SculptSettings } from "#src/state/SculptSettings.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

// CONSTANTS
const kPoint = { x: 20, z: 20 };
const kFrame = 0.05;

function holeAtPoint(
  terrain: TerrainReader
): boolean {
  return terrain.chunk([...terrain.chunks()][0].coord)!.holes.isHole(kPoint.x, kPoint.z);
}

function strokeSetup() {
  const document = new TerrainDocument();
  document.addChunk(0, 0);
  const preview = new TerrainPreview(document);
  const history = createTerrainHistory(document);
  const settings = new SculptSettings();
  settings.update({ tool: "holes", size: 2, holeMode: "cut" });
  const committed: TerrainCommand[] = [];
  document.on("change", ({ command }) => {
    if (command.action === "holes-patched") {
      committed.push(command);
    }
  });

  return {
    document,
    preview,
    history,
    committed,
    press: () => new HoleStroke({ document, preview, history, settings }, kPoint)
  };
}

describe("HoleStroke", () => {
  test("a press shows its cut at once, and confirms it as one undo step on release", () => {
    const { document, preview, history, committed, press } = strokeSetup();
    const stroke = press();

    stroke.update(kPoint, kFrame);
    stroke.update({ x: kPoint.x + 3, z: kPoint.z }, kFrame);
    assert.equal(holeAtPoint(preview.terrain), true);
    assert.equal(holeAtPoint(document.terrain), false);

    stroke.end();
    assert.equal(holeAtPoint(document.terrain), true);
    assert.deepEqual(committed.map(({ action }) => action), ["holes-patched"]);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);

    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual([holeAtPoint(document.terrain), holeAtPoint(preview.terrain)], [false, false]);
  });

  test("an inverted update fills what the cut mode would cut", () => {
    const { document, press } = strokeSetup();
    const cut = press();
    cut.update(kPoint, kFrame);
    cut.end();

    const fill = press();
    fill.update(kPoint, kFrame, true);
    fill.end();

    assert.equal(holeAtPoint(document.terrain), false);
  });
});
