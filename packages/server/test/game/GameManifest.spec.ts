// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { scriptImports } from "#src/game/GameManifest.ts";

function record(
  id: string,
  kind: string,
  path: string
): AssetRecord {
  return new AssetRecord({
    id,
    kind,
    path,
    revision: `${id}-rev`
  });
}

describe("scriptImports", () => {
  test("maps every form a relative import may take to the script's module, at the base", () => {
    const imports = scriptImports([
      record("player", "script", "scripts/Player.ts"),
      record("enemy", "script", "scripts/ai/my enemy.ts"),
      record("grass", "texture", "textures/grass.png")
    ], "../api/game/");

    const player = "../api/game/modules/scripts/Player.ts.js?revision=player-rev";
    const enemy = "../api/game/modules/scripts/ai/my enemy.ts.js?revision=enemy-rev";
    assert.deepEqual(imports, {
      "../api/game/modules/scripts/Player": player,
      "../api/game/modules/scripts/Player.js": player,
      "../api/game/modules/scripts/Player.ts": player,
      "../api/game/modules/scripts/ai/my enemy": enemy,
      "../api/game/modules/scripts/ai/my enemy.js": enemy,
      "../api/game/modules/scripts/ai/my enemy.ts": enemy
    });
  });

  test("resolves a path to the script at that exact path before another script's form", () => {
    const imports = scriptImports([
      record("typed", "script", "util.ts"),
      record("plain", "script", "util.js")
    ], "./");

    assert.equal(imports["./modules/util.js"], "./modules/util.js.js?revision=plain-rev");
    assert.equal(imports["./modules/util"], "./modules/util.ts.js?revision=typed-rev");
  });

  test("escapes the URL delimiters a project path may hold", () => {
    const imports = scriptImports([
      record("odd", "script", "100%/why?#1.ts")
    ], "./");

    assert.equal(
      imports["./modules/100%25/why%3F%231.ts"],
      "./modules/100%25/why%3F%231.ts.js?revision=odd-rev"
    );
  });
});
