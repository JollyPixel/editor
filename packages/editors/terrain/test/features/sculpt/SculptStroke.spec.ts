// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TerrainDocument,
  TerrainPreview
} from "@jolly-pixel/asset.terrain/client";
import {
  TILE_SAMPLE_COUNT,
  TileCoord,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { COMMIT_INTERVAL } from "#src/features/sculpt/model/CommitCadence.ts";
import {
  SculptSettings,
  type SculptOptions
} from "#src/features/sculpt/model/SculptSettings.ts";
import { SCULPT_TOOLS } from "#src/features/sculpt/model/sculptStamp.ts";
import { SculptStroke } from "#src/features/sculpt/model/SculptStroke.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

// CONSTANTS
const kPoint = {
  x: 32,
  z: 32
};
const kPointTile = TileCoord.containing(kPoint.x, kPoint.z);
const kFrame = 0.05;

function strokeSetup(
  options: Partial<SculptOptions> = {}
) {
  const document = new TerrainDocument();
  document.addChunk(0, 0);
  const preview = new TerrainPreview(document);
  const history = createTerrainHistory(document);
  const settings = new SculptSettings();
  settings.update(options);
  const live: TilePatch[][] = [];
  preview.on("strokeWritten", (patches) => live.push([...patches]));

  function press(
    lower = false,
    height = 0
  ): SculptStroke {
    return new SculptStroke(
      {
        preview,
        history,
        settings
      },
      {
        tool: SCULPT_TOOLS.find((tool) => tool === options.tool) ?? "raise",
        point: kPoint,
        height,
        lower
      }
    );
  }

  return {
    history,
    live,
    preview,
    press,
    shown: () => preview.terrain.sampleAt(kPoint.x, kPoint.z),
    confirmed: () => document.terrain.sampleAt(kPoint.x, kPoint.z)
  };
}

function tileHeights(
  height: number
): Float32Array {
  return new Float32Array(TILE_SAMPLE_COUNT).fill(height);
}

function hold(
  stroke: SculptStroke,
  frames: number
): void {
  for (let frame = 0; frame < frames; frame++) {
    stroke.update(kPoint, kFrame);
  }
}

describe("SculptStroke", () => {
  test("a held press shows and streams its heights, and confirms them as one undo step on release", () => {
    const { history, live, press, shown, confirmed } = strokeSetup();
    const stroke = press();

    hold(stroke, 3);
    assert.ok(shown() > 0);
    assert.equal(confirmed(), 0);
    assert.equal(live.length, 3);

    stroke.end();
    assert.equal(confirmed(), shown());
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);

    assert.equal(history.undo(TERRAIN_HISTORY_SCOPE), true);
    assert.equal(confirmed(), 0);
    assert.equal(shown(), 0);
  });

  test(`a long stroke confirms its heights every ${COMMIT_INTERVAL} s and still undoes as one step`, () => {
    const { history, press, shown, confirmed } = strokeSetup();
    const stroke = press();

    hold(stroke, Math.ceil(COMMIT_INTERVAL / kFrame) + 1);
    assert.ok(confirmed() > 0);
    hold(stroke, 1);
    assert.ok(shown() > confirmed());

    stroke.end();
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);
    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.equal(confirmed(), 0);
  });

  test("a stroke still held when the preview is torn down is confirmed as its one undo step", () => {
    const { history, preview, press, shown, confirmed } = strokeSetup();
    const stroke = press();
    hold(stroke, 3);
    const sculpted = shown();

    preview.dispose();
    stroke.end();

    assert.ok(sculpted > 0);
    assert.equal(confirmed(), sculpted);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);
    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.equal(confirmed(), 0);
  });

  test("a raise over a peer's live preview confirms only the confirmed heights plus its own lift", () => {
    const alone = strokeSetup();
    const solo = alone.press();
    hold(solo, 2);
    solo.end();

    const shared = strokeSetup();
    shared.preview.write("peer", [{ tile: kPointTile, heights: tileHeights(50) }]);
    const stroke = shared.press();
    hold(stroke, 2);
    stroke.end();

    assert.ok(alone.confirmed() > 0);
    assert.equal(shared.confirmed(), alone.confirmed());
  });

  test("a press that loses its aim stops stamping and still confirms on the commit cadence", () => {
    const { press, shown, confirmed } = strokeSetup();
    const stroke = press();
    hold(stroke, 1);
    const stamped = shown();

    for (let frame = 0; frame < Math.ceil(COMMIT_INTERVAL / kFrame); frame++) {
      stroke.update(null, kFrame);
    }

    assert.ok(stamped > 0);
    assert.equal(shown(), stamped);
    assert.equal(confirmed(), stamped);
  });

  test("a press refused while another stroke runs leaves the next stroke its own undo step", () => {
    const { history, preview, press } = strokeSetup();
    const other = preview.beginStroke();
    assert.throws(() => press());
    other.cancel();

    const stroke = press();
    hold(stroke, 2);
    stroke.end();

    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);
  });

  test("the right button lowers the ground the left button raises", () => {
    for (const [lower, sign] of [[false, 1], [true, -1]] as const) {
      const { press, confirmed } = strokeSetup();
      const stroke = press(lower);
      hold(stroke, 2);
      stroke.end();

      assert.equal(Math.sign(confirmed()), sign);
    }
  });

  test("flatten pulls toward the height under the press, or toward the fixed height once set", () => {
    const cases = [
      {
        options: { flattenTarget: "press" },
        sign: 1
      },
      {
        options: { flattenTarget: "fixed", flattenHeight: -5 },
        sign: -1
      }
    ] as const;
    for (const { options, sign } of cases) {
      const { press, confirmed } = strokeSetup({ tool: "flatten", ...options });
      const stroke = press(false, 5);
      hold(stroke, 2);
      stroke.end();

      assert.equal(Math.sign(confirmed()), sign);
    }
  });
});
