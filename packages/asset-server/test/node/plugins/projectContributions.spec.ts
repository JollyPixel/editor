// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { build } from "vite";

// Import Internal Dependencies
import {
  createProjectContributionsPlugin,
  findProjectContributions,
  PackageResolver,
  ProjectKinds,
  PROJECT_CONTRIBUTIONS_MODULE_PREFIX
} from "#src/node.ts";
import { writePackage } from "../../helpers/packages.ts";
import { tempDirectory } from "../../helpers/tempDirectory.ts";

function writeContributor(
  directory: string,
  name: string,
  marker: string
): Promise<string> {
  return writePackage(
    directory,
    {
      name,
      exports: {
        ".": "./index.js",
        "./scene": {
          import: "./scene.js"
        }
      },
      jollypixel: {
        scene: "./scene"
      }
    },
    {
      "index.js": "export const root = true;\n",
      "scene.js": `export const SCENE = ${JSON.stringify(marker)};\n`
    }
  );
}

describe("createProjectContributionsPlugin", () => {
  test("bundles the field's export of each project package that declares it", async() => {
    await using directory = await tempDirectory();
    const project = path.join(directory.root, "project");
    const host = path.join(directory.root, "host");
    const app = path.join(directory.root, "app");
    await writeContributor(
      path.join(project, "editors", "local"),
      "local-editor",
      "local-marker"
    );
    await writeContributor(
      path.join(host, "node_modules", "editor-b"),
      "editor-b",
      "fallback-marker"
    );
    await writePackage(
      path.join(host, "node_modules", "kind-c"),
      {
        name: "kind-c",
        exports: "./index.js"
      },
      {
        "index.js": "export const KIND = \"silent-marker\";\n"
      }
    );
    await fs.mkdir(app);
    await fs.writeFile(
      path.join(app, "index.html"),
      "<script type=\"module\" src=\"./main.js\"></script>"
    );
    await fs.writeFile(
      path.join(app, "main.js"),
      `import contributions from "${PROJECT_CONTRIBUTIONS_MODULE_PREFIX}scene";\n` +
      "document.title = JSON.stringify(contributions.map(({ name, module }) => [name, module.SCENE]));\n"
    );

    const outDir = path.join(app, "out");
    await build({
      root: app,
      configFile: false,
      logLevel: "silent",
      build: {
        outDir
      },
      plugins: [
        createProjectContributionsPlugin(
          new ProjectKinds([], new PackageResolver(project, {
            fallbacks: [host]
          })),
          ["./editors/local", "editor-b", "kind-c", "editor-b"]
        )
      ]
    });

    const [bundleFile] = await fs.readdir(path.join(outDir, "assets"));
    const bundle = await fs.readFile(
      path.join(outDir, "assets", bundleFile),
      "utf8"
    );
    assert.match(bundle, /local-marker/);
    assert.match(bundle, /fallback-marker/);
    assert.doesNotMatch(bundle, /silent-marker/);
    assert.strictEqual(bundle.match(/fallback-marker/g)?.length, 1);
  });
});

describe("findProjectContributions", () => {
  test("refuses a field that does not name an export subpath", async() => {
    await using directory = await tempDirectory();
    await writePackage(
      path.join(directory.root, "node_modules", "editor-a"),
      {
        name: "editor-a",
        exports: "./index.js",
        jollypixel: {
          scene: "scene.js"
        }
      },
      {
        "index.js": "export {};\n"
      }
    );

    assert.throws(
      () => findProjectContributions(
        ["editor-a"],
        new PackageResolver(directory.root),
        "scene"
      ),
      /"editor-a" must name an export subpath in "jollypixel.scene"/
    );
  });
});
