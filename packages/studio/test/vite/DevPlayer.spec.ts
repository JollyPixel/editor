// Import Node.js Dependencies
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  createLogger,
  type Plugin
} from "vite";

// Import Internal Dependencies
import { DevPlayer } from "../../vite/DevPlayer.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kPage = [
  "<!DOCTYPE html>",
  "<html><head><title>Game</title></head>",
  "<body><script type=\"module\" src=\"../src/main.ts\"></script></body>",
  "</html>"
].join("\n");
const kBuiltAt = new Date("2026-01-01T00:00:00.000Z");
const kEditedAt = new Date("2026-01-01T01:00:00.000Z");
const kScriptSource = /<script type="module" crossorigin src="\.\.\/([^"]+)"/;
const kFlavourPackage = {
  name: "flavour",
  type: "module",
  exports: {
    ".": {
      development: "./development.js",
      default: "./production.js"
    }
  }
};

describe("DevPlayer", () => {
  let root: string;
  let builds: number;
  let player: DevPlayer;
  let nodeEnv: string | undefined;

  before(() => {
    nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
  });

  after(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  beforeEach(async() => {
    root = await createTempDir("studio-dev-player-");
    await fs.mkdir(path.join(root, "play"));
    await fs.mkdir(path.join(root, "src"));
    await fs.writeFile(path.join(root, "play", "index.html"), kPage);
    await fs.utimes(path.join(root, "play", "index.html"), kBuiltAt, kBuiltAt);
    await writeMain(root, "first", kBuiltAt);
    await writeFlavourPackage(root);

    builds = 0;
    player = new DevPlayer({
      root,
      plugins: [countBuilds(() => builds++)],
      logger: createLogger("silent")
    });
  });

  afterEach(() => removeTempDir(root));

  test("bundles the built play page with the chunk it loads", async() => {
    const { page, files } = await player.bundle();

    const script = kScriptSource.exec(page)?.[1];
    assert.ok(script !== undefined, page);
    assert.match(new TextDecoder().decode(files.get(script)), /first/);
  });

  test("ships a production build from the dev server's development process", async() => {
    const files = (await player.bundle()).files;

    const code = Array.from(
      files.values(),
      (bytes) => new TextDecoder().decode(bytes)
    ).join("\n");
    assert.match(code, /production flavour/);
    assert.doesNotMatch(code, /development flavour|development branch/);
  });

  test("builds once while no module of the player changes", async() => {
    await Promise.all([player.bundle(), player.bundle()]);
    await player.bundle();

    assert.equal(builds, 1);
  });

  test("rebuilds after a module of the player changes", async() => {
    await player.bundle();
    await writeMain(root, "second edit", kEditedAt);

    const files = (await player.bundle()).files;

    assert.equal(builds, 2);
    assert.ok(
      Array.from(files.values()).some(
        (bytes) => new TextDecoder().decode(bytes).includes("second edit")
      )
    );
  });

  test("builds again after a failed build", async() => {
    await fs.writeFile(path.join(root, "src", "main.ts"), "document.title = ;");
    await assert.rejects(player.bundle());

    await writeMain(root, "fixed", kEditedAt);
    const { page } = await player.bundle();

    assert.match(page, kScriptSource);
  });
});

async function writeMain(
  root: string,
  title: string,
  modifiedAt: Date
): Promise<void> {
  const file = path.join(root, "src", "main.ts");
  await fs.writeFile(file, [
    "import { flavour } from \"flavour\";",
    `document.title = "${title}";`,
    "document.body.dataset.flavour = flavour;",
    "if (import.meta.env.DEV || process.env.NODE_ENV !== \"production\") {",
    "  document.body.dataset.branch = \"development branch\";",
    "}"
  ].join("\n"));
  await fs.utimes(file, modifiedAt, modifiedAt);
}

async function writeFlavourPackage(
  root: string
): Promise<void> {
  const folder = path.join(root, "node_modules", "flavour");
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(
    path.join(folder, "package.json"),
    JSON.stringify(kFlavourPackage)
  );
  for (const flavour of ["development", "production"]) {
    await fs.writeFile(
      path.join(folder, `${flavour}.js`),
      `export const flavour = "${flavour} flavour";\n`
    );
  }
}

function countBuilds(
  onBuild: () => void
): Plugin {
  return {
    name: "count-builds",
    buildStart: onBuild
  };
}
