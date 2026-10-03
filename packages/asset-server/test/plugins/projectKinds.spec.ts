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
  createProjectKindsPlugin,
  KindPackage,
  PackageResolver,
  ProjectFile,
  ProjectKinds,
  projectHandlersModule,
  PROJECT_HANDLERS_MODULE_ID
} from "#src/node.ts";
import { kindPackage } from "../helpers/kindPackages.ts";
import { writeKindPackage } from "../helpers/packages.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";

describe("projectHandlersModule", () => {
  test("builds the handlers of each kind package with its options", () => {
    const options = {
      chunkSize: 8
    };
    const kinds = new ProjectKinds([
      new KindPackage({
        name: "@scope/kind-a",
        options,
        descriptors: [],
        handlers: kindPackage(["alpha"]).handlers(options)
      })
    ], new PackageResolver(import.meta.dirname));

    assert.strictEqual(
      projectHandlersModule(kinds),
      "import { textureAssetKind } from \"@jolly-pixel/asset-server\";\n" +
      "import { ASSET_KINDS as kinds0 } from \"@scope/kind-a\";\n" +
      "\n" +
      "export default function createHandlers() {\n" +
      "  return [\n" +
      "    ...kinds0.handlers({\"chunkSize\":8}),\n" +
      "    textureAssetKind()\n" +
      "  ];\n" +
      "}\n"
    );
  });
});

describe("createProjectKindsPlugin", () => {
  test("bundles kind packages resolved from the project", async() => {
    await using workspace = await tempWorkspace();
    const project = path.join(workspace.root, "project");
    const host = path.join(workspace.root, "host");
    const app = path.join(workspace.root, "app");
    await writeKindPackage(
      path.join(project, "kinds", "local"),
      "local-kind",
      "local-marker"
    );
    await writeKindPackage(
      path.join(host, "node_modules", "kind-b"),
      "kind-b",
      "fallback-marker"
    );
    await fs.mkdir(app);
    await fs.writeFile(
      path.join(app, "index.html"),
      "<script type=\"module\" src=\"./main.js\"></script>"
    );
    await fs.writeFile(
      path.join(app, "main.js"),
      `import createHandlers from "${PROJECT_HANDLERS_MODULE_ID}";\n` +
      "document.title = JSON.stringify(createHandlers());\n"
    );
    await fs.writeFile(
      path.join(app, "texture.js"),
      "export const textureAssetKind = () => ({ kind: \"texture\" });\n"
    );
    const kinds = await ProjectKinds.load(
      new ProjectFile(project, {
        version: 1,
        kinds: {
          "./kinds/local": {},
          "kind-b": {}
        }
      }),
      {
        resolver: new PackageResolver(project, {
          fallbacks: [host]
        })
      }
    );

    const outDir = path.join(app, "out");
    await build({
      root: app,
      configFile: false,
      logLevel: "silent",
      resolve: {
        alias: {
          "@jolly-pixel/asset-server": path.join(app, "texture.js")
        }
      },
      build: {
        outDir
      },
      plugins: [createProjectKindsPlugin(kinds)]
    });

    const [bundleFile] = await fs.readdir(path.join(outDir, "assets"));
    const bundle = await fs.readFile(
      path.join(outDir, "assets", bundleFile),
      "utf8"
    );
    assert.match(bundle, /local-marker/);
    assert.match(bundle, /fallback-marker/);
  });
});
