// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  IslandMap,
  NormalMapConfig,
  UVMap,
  type IslandFace,
  type UVRegion
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { NormalMapOverview } from "#src/normal/NormalMapOverview.ts";

// CONSTANTS
const kSize = {
  x: 16,
  y: 8
};

function regions(): UVRegion[] {
  const uv = new UVMap({ getCanvasSize: () => kSize });

  return ["brick", "glass", "moss"].map((id) => uv.create({
    id,
    name: id.toUpperCase(),
    width: 4,
    height: 4
  }));
}

function face(
  regionId: string,
  x: number,
  width = 4
): IslandFace {
  return {
    regionId,
    geometry: { x, y: 0, width, height: 4 }
  };
}

describe("NormalMapOverview", () => {
  test("lists zones in order with their region name", () => {
    const config = NormalMapConfig.create()
      .withZone({ regionId: "glass", settings: "off" })
      .withZone({ regionId: "brick", settings: { strength: 4 } });
    const overview = new NormalMapOverview(
      config,
      regions(),
      IslandMap.fromFaces(kSize, [face("brick", 0), face("glass", 8)])
    );

    assert.deepEqual(
      overview.zones.map((row) => [row.zone.regionId, row.name, row.region?.id]),
      [["glass", "GLASS", "glass"], ["brick", "BRICK", "brick"]]
    );
    assert.deepEqual(overview.findZoneRow("brick")?.zone.settings, { strength: 4 });
    assert.equal(overview.findZoneRow("moss"), undefined);
  });

  test("a zone whose region is missing is orphaned", () => {
    const config = NormalMapConfig.create()
      .withZone({ regionId: "gone", settings: "off" });
    const overview = new NormalMapOverview(
      config,
      regions(),
      IslandMap.fromFaces(kSize, [])
    );

    assert.equal(overview.zones[0].region, null);
    assert.equal(overview.zones[0].name, "gone");
    assert.deepEqual(overview.zones[0].sharedWith, []);
  });

  test("names the newer zone a merged island resolves to", () => {
    const config = NormalMapConfig.create()
      .withZone({ regionId: "brick", settings: { strength: 4 } })
      .withZone({ regionId: "glass", settings: "off" });
    const overview = new NormalMapOverview(
      config,
      regions(),
      IslandMap.fromFaces(kSize, [face("brick", 0), face("glass", 2)])
    );

    assert.deepEqual(overview.findZoneRow("brick")?.sharedWith, ["GLASS"]);
    assert.deepEqual(overview.findZoneRow("glass")?.sharedWith, []);
  });

  test("a merged island without a competing zone shares nothing", () => {
    const config = NormalMapConfig.create()
      .withZone({ regionId: "brick", settings: { strength: 4 } });
    const overview = new NormalMapOverview(
      config,
      regions(),
      IslandMap.fromFaces(kSize, [face("brick", 0), face("moss", 2)])
    );

    assert.deepEqual(overview.findZoneRow("brick")?.sharedWith, []);
  });

  describe("wrapFallback", () => {
    test("counts the islands the defaults govern that are not one rect", () => {
      const overview = new NormalMapOverview(
        NormalMapConfig.create(),
        regions(),
        IslandMap.fromFaces(kSize, [
          face("brick", 0),
          face("glass", 2),
          face("moss", 8)
        ])
      );

      assert.deepEqual(overview.wrapFallback(null), {
        islands: 1,
        remainder: true
      });
    });

    test("leaves out islands a zone governs", () => {
      const config = NormalMapConfig.create()
        .withZone({ regionId: "glass", settings: { strength: 1 } });
      const overview = new NormalMapOverview(
        config,
        regions(),
        IslandMap.fromFaces(kSize, [face("brick", 0), face("glass", 2)])
      );

      assert.deepEqual(overview.wrapFallback(null), {
        islands: 0,
        remainder: true
      });
      assert.deepEqual(overview.wrapFallback("glass"), {
        islands: 1,
        remainder: false
      });
    });

    test("ignores islands that do not wrap", () => {
      const config = NormalMapConfig.create({ border: "clamp" })
        .withZone({ regionId: "glass", settings: "off" });
      const overview = new NormalMapOverview(
        config,
        regions(),
        IslandMap.fromFaces(kSize, [face("brick", 0), face("glass", 2)])
      );

      assert.deepEqual(overview.wrapFallback(null), {
        islands: 0,
        remainder: false
      });
      assert.deepEqual(overview.wrapFallback("glass"), {
        islands: 0,
        remainder: false
      });
    });
  });
});
