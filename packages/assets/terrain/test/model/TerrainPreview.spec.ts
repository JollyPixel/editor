// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  terrainSnapshot
} from "#src/index.ts";
import {
  TerrainCommandDocument,
  TerrainPreview,
  type TerrainStroke
} from "#src/network/client.ts";
import { tileHeights } from "../helpers/terrain.ts";

// CONSTANTS
const kTile = new TileCoord(new ChunkCoord(0, 0), 1, 1);
const kNextTile = new TileCoord(kTile.chunk, 2, 1);
const kEdgeTile = new TileCoord(new ChunkCoord(1, 0), 0, 1);

function heightAt(
  terrain: TerrainReader,
  tile: TileCoord
): number | undefined {
  return terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z)[0];
}

function previewSetup() {
  const document = new TerrainCommandDocument();
  document.addChunk(0, 0);
  const preview = new TerrainPreview(document);

  function displayed(): number {
    return preview.terrain.chunk(kTile.chunk)!.tileHeights(kTile.x, kTile.z)[0];
  }

  return { document, preview, displayed };
}

describe("TerrainPreview", () => {
  test("shows the newest preview of a tile and uncovers the older one when it is dropped", () => {
    const { preview, displayed } = previewSetup();
    const stroke = preview.beginStroke();

    preview.write("peer", [{ tile: kTile, heights: tileHeights(4) }]);
    stroke.write([{ tile: kTile, heights: tileHeights(9) }]);
    assert.equal(displayed(), 9);

    stroke.cancel();
    assert.equal(displayed(), 4);

    preview.drop("peer");
    assert.equal(displayed(), 0);
  });

  test("a committed stroke reports no tile change, since its heights are already shown", () => {
    const { document, preview, displayed } = previewSetup();
    const stroke = preview.beginStroke();
    stroke.write([{ tile: kTile, heights: tileHeights(9) }]);
    const changed: unknown[] = [];
    preview.on("tilesChanged", (tiles) => changed.push(tiles));

    assert.equal(stroke.commit(), true);

    assert.equal(displayed(), 9);
    assert.equal(document.terrain.chunk(kTile.chunk)!.tileHeights(kTile.x, kTile.z)[0], 9);
    assert.deepEqual(changed, []);
  });

  test("a write with an out-of-range height changes nothing and keeps the earlier tiles", () => {
    const { document, preview } = previewSetup();
    const stroke = preview.beginStroke();
    stroke.write([{ tile: kTile, heights: tileHeights(9) }]);

    assert.throws(() => stroke.write([
      { tile: kNextTile, heights: tileHeights(5) },
      { tile: kTile, heights: tileHeights(Number.NaN) }
    ]), RangeError);

    assert.equal(heightAt(preview.terrain, kNextTile), 0);
    assert.equal(stroke.commit(), true);
    assert.equal(heightAt(document.terrain, kTile), 9);
    assert.equal(heightAt(document.terrain, kNextTile), 0);
  });

  test("a reload keeps previews on the chunks it keeps and drops those on the chunks it removes", () => {
    const { document, preview, displayed } = previewSetup();
    document.addChunk(1, 0);
    const kept = terrainSnapshot(document.terrain).chunks
      .filter(({ x }) => x === 0);
    const stroke = preview.beginStroke();
    stroke.write([{ tile: kTile, heights: tileHeights(9) }]);
    preview.write("peer", [{ tile: kEdgeTile, heights: tileHeights(4) }]);
    const events: string[] = [];
    preview.on("tilesChanged", () => events.push("tilesChanged"));
    preview.on("reset", () => events.push("reset"));

    document.load({ chunks: kept });

    assert.deepEqual(events, ["reset"]);
    assert.equal(displayed(), 9);
    assert.equal(heightAt(stroke.terrain, kTile), 9);
    assert.equal(preview.terrain.has(kEdgeTile.chunk), false);
    assert.equal(stroke.terrain.has(kEdgeTile.chunk), false);
    preview.drop("peer");
    assert.equal(stroke.commit(), true);
    assert.equal(heightAt(document.terrain, kTile), 9);
  });

  test("the stroke's terrain shows its own tiles over the confirmed heights, never a peer's preview", () => {
    const { preview, displayed } = previewSetup();
    const stroke = preview.beginStroke();

    preview.write("peer", [{ tile: kTile, heights: tileHeights(4) }]);
    stroke.write([{ tile: kNextTile, heights: tileHeights(9) }]);

    assert.equal(displayed(), 4);
    assert.equal(heightAt(stroke.terrain, kTile), 0);
    assert.equal(heightAt(stroke.terrain, kNextTile), 9);
  });

  test("the stroke's terrain follows the chunks the document adds and removes", () => {
    const { document, preview } = previewSetup();
    const stroke = preview.beginStroke();

    document.addChunk(1, 0);
    assert.equal(stroke.terrain.has(kEdgeTile.chunk), true);
    stroke.write([{ tile: kEdgeTile, heights: tileHeights(9) }]);
    assert.equal(heightAt(stroke.terrain, kEdgeTile), 9);

    document.removeChunk(1, 0);
    assert.equal(stroke.terrain.has(kEdgeTile.chunk), false);
    assert.equal(stroke.commit(), false);
  });

  test("a remote patch on a stroke tile replaces the stroke's heights there", () => {
    const { document, preview, displayed } = previewSetup();
    const stroke = preview.beginStroke();
    stroke.write([{ tile: kTile, heights: tileHeights(9) }]);

    document.apply({
      action: "heights-patched",
      tiles: [encodeTilePatch({ tile: kTile, heights: tileHeights(3) })]
    }, "peer");

    assert.equal(heightAt(stroke.terrain, kTile), 3);
    assert.equal(displayed(), 3);
    assert.equal(stroke.commit(), false);
  });

  test("the stroke's terrain matches the confirmed heights once the stroke commits or cancels", () => {
    const cases = [
      {
        settle: (stroke: TerrainStroke) => stroke.commit(),
        height: 9
      },
      {
        settle: (stroke: TerrainStroke) => stroke.cancel(),
        height: 0
      }
    ];
    for (const { settle, height } of cases) {
      const { document, preview, displayed } = previewSetup();
      const stroke = preview.beginStroke();
      stroke.write([{ tile: kTile, heights: tileHeights(9) }]);

      settle(stroke);

      assert.equal(heightAt(document.terrain, kTile), height);
      assert.equal(heightAt(stroke.terrain, kTile), height);
      assert.equal(displayed(), height);
    }
  });

  test("a write after the stroke ends or cancels shows nothing and leaves nothing to commit", () => {
    const cases = [
      (stroke: TerrainStroke) => stroke.end(),
      (stroke: TerrainStroke) => stroke.cancel()
    ];
    for (const finish of cases) {
      const { document, preview, displayed } = previewSetup();
      const stroke = preview.beginStroke();
      finish(stroke);

      stroke.write([{ tile: kTile, heights: tileHeights(9) }]);
      preview.write("peer", [{ tile: kTile, heights: tileHeights(4) }]);
      preview.drop("peer");

      assert.equal(displayed(), 0);
      assert.equal(stroke.commit(), false);
      assert.equal(heightAt(document.terrain, kTile), 0);
    }
  });

  test("a second local stroke cannot begin until the first one ends", () => {
    const { preview } = previewSetup();
    const stroke = preview.beginStroke();

    assert.throws(() => preview.beginStroke(), Error);

    stroke.end();
    preview.beginStroke().cancel();
  });

  test("strokeSettled fires once the confirmed and stroke heights are up to date", () => {
    const { document, preview } = previewSetup();
    document.addChunk(1, 0);
    const stroke = preview.beginStroke();
    const seen: unknown[] = [];
    preview.on("strokeSettled", () => seen.push([
      heightAt(document.terrain, kTile),
      heightAt(stroke.terrain, kTile),
      stroke.terrain.has(kEdgeTile.chunk)
    ]));

    stroke.write([{ tile: kTile, heights: tileHeights(9) }]);
    stroke.commit();
    stroke.write([{ tile: kEdgeTile, heights: tileHeights(4) }]);
    document.removeChunk(1, 0);

    assert.deepEqual(seen, [[9, 9, true], [9, 9, false]]);
  });

  test("dispose commits the stroke in flight, then ignores later writes and emits nothing", () => {
    const { document, preview, displayed } = previewSetup();
    const stroke = preview.beginStroke();
    stroke.write([{ tile: kTile, heights: tileHeights(9) }]);
    const changed: unknown[] = [];
    preview.on("tilesChanged", (tiles) => changed.push(tiles));

    preview.dispose();
    preview.write("peer", [{ tile: kNextTile, heights: tileHeights(4) }]);
    stroke.write([{ tile: kNextTile, heights: tileHeights(5) }]);

    assert.equal(heightAt(document.terrain, kTile), 9);
    assert.equal(displayed(), 9);
    assert.equal(heightAt(preview.terrain, kNextTile), 0);
    assert.deepEqual(changed, []);
    assert.equal(stroke.commit(), false);
  });
});
