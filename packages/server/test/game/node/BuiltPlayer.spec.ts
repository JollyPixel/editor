// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BuiltPlayer } from "#src/game/node/BuiltPlayer.ts";
import { GamePlayerError } from "#src/game/node/errors/GamePlayerError.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kPage = [
  "<html><head>",
  "<script type=\"importmap\">{\"imports\":{\"three\":\"../assets/player-three-f6.js\"}}</script>",
  "<script type=\"module\" crossorigin src=\"../assets/play-a1.js\"></script>",
  "<link rel=\"stylesheet\" href=\"../assets/play-a1.css\">",
  "</head><body></body></html>"
].join("\n");
const kBuild = {
  "play/index.html": {
    file: "assets/play-a1.js",
    imports: ["_three-b2.js"],
    dynamicImports: ["physics.ts"],
    css: ["assets/play-a1.css"]
  },
  "_three-b2.js": {
    file: "assets/three-b2.js"
  },
  "physics.ts": {
    file: "assets/physics-c3.js",
    imports: ["_three-b2.js"],
    assets: ["assets/rapier-d4.wasm"]
  },
  "src/play/modules/three.ts": {
    file: "assets/player-three-f6.js",
    imports: ["_three-b2.js"]
  },
  "index.html": {
    file: "assets/shell-e5.js",
    imports: ["_three-b2.js"]
  }
};

describe("BuiltPlayer", () => {
  let shell: string;

  before(async() => {
    shell = await createTempDir("built-player-");
    await writeFiles(shell, {
      ".vite/manifest.json": JSON.stringify(kBuild),
      "play/index.html": kPage,
      "assets/play-a1.js": "play",
      "assets/play-a1.css": "css",
      "assets/three-b2.js": "three",
      "assets/physics-c3.js": "physics",
      "assets/rapier-d4.wasm": "wasm",
      "assets/shell-e5.js": "shell",
      "assets/player-three-f6.js": "export * from \"./three-b2.js\";"
    });
  });

  after(() => removeTempDir(shell));

  test("bundles the built play page with only the files it and its import map load", async() => {
    const { page, files } = await new BuiltPlayer(shell).bundle();

    assert.equal(page, kPage);
    assert.deepEqual([...files.keys()].sort(), [
      "assets/physics-c3.js",
      "assets/play-a1.css",
      "assets/play-a1.js",
      "assets/player-three-f6.js",
      "assets/rapier-d4.wasm",
      "assets/three-b2.js"
    ]);
  });

  test("asks to build the studio when the build is missing", async() => {
    await assert.rejects(
      new BuiltPlayer(path.join(shell, "missing")).bundle(),
      (error) => error instanceof GamePlayerError &&
        error.message.includes("build the studio")
    );
  });
});

async function writeFiles(
  root: string,
  files: Record<string, string>
): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
}
