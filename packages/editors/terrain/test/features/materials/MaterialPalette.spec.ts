// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  GROUND_MATERIAL,
  TerrainDocument,
  type TerrainMaterialMap
} from "@jolly-pixel/asset.terrain/client";

// Import Internal Dependencies
import { MaterialPalette } from "#src/features/materials/model/MaterialPalette.ts";
import { MaterialSelection } from "#src/features/materials/model/MaterialSelection.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

interface CatalogEntry {
  id: string;
  kind: string;
  path: string;
}

function paletteSetup(
  existing: string[] = []
) {
  const document = new TerrainDocument();
  document.load({ chunks: [{ x: 0, z: 0 }] });
  const history = createTerrainHistory(document);
  const selection = new MaterialSelection(document);
  const records = new Map<string, CatalogEntry>(
    existing.map((path) => [path, { id: path, kind: "texture", path }])
  );
  const imported: string[] = [];
  let picked: string | null = null;
  const palette = new MaterialPalette({
    document,
    selection,
    history,
    importFolder: "world/textures",
    catalog: {
      records: () => records.values(),
      record: (id) => records.get(id),
      create: (path, _content, options) => {
        imported.push(path);
        records.set(path, { id: path, kind: options?.kind ?? "binary", path });

        return Promise.resolve(path);
      }
    },
    pickTexture: () => Promise.resolve<TerrainMaterialMap | null>(
      picked === null ? null : { id: picked, kind: "texture" }
    )
  });

  return {
    document,
    history,
    selection,
    palette,
    imported,
    pick(path: string | null): void {
      picked = path;
    }
  };
}

function file(
  name: string
) {
  return { name, bytes: new Uint8Array([1]) };
}

describe("MaterialPalette", () => {
  test("a picked texture brings its siblings from its folder, and the new material is selected", async() => {
    const { document, palette, selection, pick } = paletteSetup([
      "rocks/rock_albedo.png",
      "rocks/rock_normal.png",
      "rocks/rock_height.png",
      "rocks/sand_normal.png",
      "other/rock_orm.png"
    ]);
    pick("rocks/rock_albedo.png");

    const id = await palette.addFromPicker();

    const material = document.materials.material(id!)!;
    assert.deepEqual(
      [material.name, material.albedo?.id, material.normal?.id, material.height?.id, material.orm],
      ["Rock", "rocks/rock_albedo.png", "rocks/rock_normal.png", "rocks/rock_height.png", null]
    );
    assert.equal(selection.selected, id);
  });

  test("dropped images are imported beside the terrain, one material and undo step per name", async() => {
    const { document, history, palette, imported } = paletteSetup();

    const added = await palette.addFromFiles([
      file("rock_albedo.png"),
      file("grass.png"),
      file("rock_normal.png")
    ]);

    assert.deepEqual(imported, [
      "world/textures/rock_albedo.png",
      "world/textures/rock_normal.png",
      "world/textures/grass.png"
    ]);
    assert.deepEqual(
      added.map((id) => document.materials.material(id)!.name),
      ["Rock", "Grass"]
    );
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 2);
    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual(document.materials.materials().map(({ name }) => name), ["Ground", "Rock"]);
  });

  test("a map can be replaced by a dropped image and cleared", async() => {
    const { document, palette } = paletteSetup();

    await palette.dropMap(GROUND_MATERIAL.id, "height", file("ground_height.png"));
    const { height } = document.materials.material(GROUND_MATERIAL.id)!;
    assert.equal(height?.id, "world/textures/ground_height.png");

    palette.clearMap(GROUND_MATERIAL.id, "height");
    assert.equal(document.materials.material(GROUND_MATERIAL.id)!.height, null);
  });

  test("a blank name is refused", () => {
    const { document, palette } = paletteSetup();

    assert.equal(palette.rename(GROUND_MATERIAL.id, "   "), false);
    assert.equal(palette.rename(GROUND_MATERIAL.id, " Dirt "), true);
    assert.equal(document.materials.material(GROUND_MATERIAL.id)!.name, "Dirt");
  });
});

describe("MaterialSelection", () => {
  test("removing the selected material selects the first one left, or none", async() => {
    const { document, palette, selection } = paletteSetup();
    const [rock] = await palette.addFromFiles([file("rock.png")]);
    assert.equal(selection.selected, rock);

    palette.remove(rock);
    assert.equal(selection.selected, GROUND_MATERIAL.id);

    palette.remove(GROUND_MATERIAL.id);
    assert.equal(selection.selected, null);
    assert.equal(document.materials.size, 0);
  });
});
