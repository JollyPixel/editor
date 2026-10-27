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
import {
  MaterialPalette,
  type TextureConflict
} from "#src/features/materials/model/MaterialPalette.ts";
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
  existing: string[] = [],
  conflict: TextureConflict | null = "keep"
) {
  const document = new TerrainDocument();
  document.load({ chunks: [{ x: 0, z: 0 }] });
  const history = createTerrainHistory(document);
  const selection = new MaterialSelection(document);
  const records = new Map<string, CatalogEntry>(
    existing.map((path) => [path, { id: path, kind: "texture", path }])
  );
  const imported: string[] = [];
  const replaced: string[] = [];
  const asked: string[][] = [];
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
        const id = records.has(path) ? `${path} (1)` : path;
        records.set(id, { id, kind: options?.kind ?? "binary", path: id });

        return Promise.resolve(id);
      },
      replace: (id) => {
        replaced.push(id);

        return Promise.resolve({ replaced: true });
      }
    },
    pickTexture: () => Promise.resolve<TerrainMaterialMap | null>(
      picked === null ? null : { id: picked, kind: "texture" }
    ),
    askConflict: (paths) => {
      asked.push([...paths]);

      return Promise.resolve(conflict);
    }
  });

  return {
    document,
    history,
    selection,
    palette,
    imported,
    replaced,
    asked,
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

  test("re-dropped images ask once, then replace in place, keep both, or import nothing", async() => {
    const existing = ["world/textures/rock_albedo.png", "world/textures/rock_normal.png"];
    const files = [file("rock_albedo.png"), file("rock_normal.png"), file("grass.png")];
    const grass = "world/textures/grass.png";
    const cases = [
      { conflict: "replace", replaced: existing, imported: [grass], names: ["Rock", "Grass"] },
      { conflict: "keep", replaced: [], imported: [...existing, grass], names: ["Rock", "Rock", "Grass"] },
      { conflict: null, replaced: [], imported: [], names: ["Rock"] }
    ] as const;
    for (const expected of cases) {
      const { document, palette, selection, asked, replaced, imported } = paletteSetup(
        existing,
        expected.conflict
      );
      const rock = document.addMaterial({
        name: "Rock",
        albedo: { id: existing[0], kind: "texture" },
        normal: { id: existing[1], kind: "texture" }
      })!;
      const selectedBefore = selection.selected;

      const added = await palette.addFromFiles(files);

      const message = String(expected.conflict);
      assert.deepEqual(asked, [existing], message);
      assert.deepEqual(replaced, expected.replaced, message);
      assert.deepEqual(imported, expected.imported, message);
      assert.deepEqual(document.materials.materials().map(({ name }) => name), ["Ground", ...expected.names]);
      assert.equal(added[0] === rock, expected.conflict === "replace", message);
      assert.equal(added.length, expected.conflict === null ? 0 : 2, message);
      assert.equal(selection.selected, added.at(-1) ?? selectedBefore, message);
    }
  });

  test("a re-dropped map replaces the texture a material already uses, without an undo step", async() => {
    const existing = ["world/textures/ground_height.png"];
    const { document, history, palette, replaced } = paletteSetup(existing, "replace");
    history.record(TERRAIN_HISTORY_SCOPE, null, () => document.updateMaterial(GROUND_MATERIAL.id, {
      height: { id: existing[0], kind: "texture" }
    }));
    const undoCount = history.state(TERRAIN_HISTORY_SCOPE).undoCount;

    assert.equal(await palette.dropMap(GROUND_MATERIAL.id, "height", file("ground_height.png")), true);

    assert.deepEqual(replaced, existing);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, undoCount);
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
