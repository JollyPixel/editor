// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  ScriptImportError,
  ScriptModules
} from "@jolly-pixel/scripting";

function record(
  kind: string,
  path: string
): AssetRecord {
  return new AssetRecord({
    id: path,
    kind,
    path
  });
}

describe("ScriptModules", () => {
  const player = record("script", "scripts/Player.ts");
  const vector = record("script", "scripts/math/vector.ts");
  const typed = record("script", "util.ts");
  const plain = record("script", "util.js");
  const grass = record("texture", "textures/grass.png");
  const scripts = new ScriptModules([player, vector, typed, plain, grass]);

  test("follows each relative import to the script it names, with or without an extension", async() => {
    const imported = await scripts.imported(player, [
      "import { Behavior } from \"@jolly-pixel/engine\";",
      "import { zero } from \"./math/vector\";",
      "import { one } from \"./math/vector.js\";",
      "import { two } from \"./math/vector.ts\";",
      "import { util } from \"../util.ts\";"
    ].join("\n"));

    assert.deepEqual(imported, [vector, vector, vector, typed]);
  });

  test("resolves a path to the script at that exact path before another script's form", () => {
    assert.equal(scripts.resolve("util.js"), plain);
    assert.equal(scripts.resolve("util"), typed);
    assert.equal(scripts.resolve("util.ts"), typed);

    const twice = record("script", "util.js.ts");
    assert.equal(new ScriptModules([typed, twice]).resolve("util.js"), twice);
  });

  test("refuses a relative import that names no script of the game", async() => {
    for (const specifier of ["./Missing", "../textures/grass.png"]) {
      await assert.rejects(
        scripts.imported(player, `import x from "${specifier}";`),
        (error) => error instanceof ScriptImportError &&
          error.message === `"scripts/Player.ts" imports "${specifier}", which is no script of the game.`
      );
    }
  });
});
