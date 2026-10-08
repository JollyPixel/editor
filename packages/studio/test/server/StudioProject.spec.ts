// Import Node.js Dependencies
import {
  after,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { PROJECT_FILE_PATH } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  DEFAULT_PROJECT_DIR,
  DEFAULT_PROJECT_FILE,
  PROJECT_ROOT_ENV,
  StudioProject
} from "../../server/StudioProject.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kBase = path.resolve("/studio");
const kRoots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await createTempDir("studio-project-");
  kRoots.push(root);

  return root;
}

async function writeProjectFile(
  root: string,
  content: unknown
): Promise<string> {
  const file = path.join(root, PROJECT_FILE_PATH);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(content));

  return file;
}

async function installEditorPackage(
  root: string,
  name: string
): Promise<string> {
  const directory = path.join(root, "node_modules", name);
  await fs.mkdir(path.join(directory, "dist"), { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name,
      jollypixel: {
        editor: {
          name,
          kinds: [name]
        }
      }
    })
  );

  return directory;
}

describe("StudioProject", () => {
  after(async() => {
    await Promise.all(kRoots.map((root) => removeTempDir(root)));
  });

  describe("resolveRoot", () => {
    test("defaults to the project folder beside the package", () => {
      assert.strictEqual(
        StudioProject.resolveRoot(kBase, {}),
        path.join(kBase, DEFAULT_PROJECT_DIR)
      );
    });

    test("ignores a blank variable", () => {
      assert.strictEqual(
        StudioProject.resolveRoot(kBase, { [PROJECT_ROOT_ENV]: "  " }),
        path.join(kBase, DEFAULT_PROJECT_DIR)
      );
    });

    test("resolves a relative variable against the package", () => {
      assert.strictEqual(
        StudioProject.resolveRoot(kBase, { [PROJECT_ROOT_ENV]: "../game" }),
        path.resolve(kBase, "../game")
      );
    });

    test("keeps an absolute variable", () => {
      const absolute = path.resolve("/games/demo");

      assert.strictEqual(
        StudioProject.resolveRoot(kBase, { [PROJECT_ROOT_ENV]: absolute }),
        absolute
      );
    });
  });

  describe("open", () => {
    test("resolves packages from the project before the studio", async() => {
      const root = await createRoot();
      const installed = await installEditorPackage(root, "editor-a");
      const local = path.join(root, "editors", "local");
      await fs.mkdir(local, { recursive: true });
      await fs.writeFile(
        path.join(local, "package.json"),
        JSON.stringify({
          jollypixel: {
            editor: {
              name: "local",
              kinds: ["local-kind"]
            }
          }
        })
      );
      const kind = path.join(root, "kinds", "local");
      await fs.mkdir(kind, { recursive: true });
      await fs.writeFile(
        path.join(kind, "package.json"),
        JSON.stringify({
          type: "module",
          main: "./index.js"
        })
      );
      await fs.writeFile(
        path.join(kind, "index.js"),
        "export const ASSET_KINDS = {\n" +
        "  descriptors: [],\n" +
        "  optionsSchema: { type: \"object\" },\n" +
        "  handlers: () => [{ kind: \"local-kind\" }]\n" +
        "};\n"
      );
      await writeProjectFile(root, {
        version: 1,
        editors: ["editor-a", "./editors/local"],
        kinds: {
          "./kinds/local": {},
          "@jolly-pixel/asset.voxel-model": {}
        }
      });

      const project = await StudioProject.open(root);
      const [editorA, localEditor] = project.editors;

      assert.strictEqual(
        editorA.dist,
        path.join(await fs.realpath(installed), "dist")
      );
      assert.ok(editorA.prebuilt);
      assert.ok(!localEditor.prebuilt);
      assert.strictEqual(
        localEditor.dist,
        path.join(await fs.realpath(local), "dist")
      );
      assert.deepEqual(
        project.kinds.handlers().map((handler) => handler.kind),
        ["local-kind", "voxelmodel", "texture"]
      );
    });

    test("writes and opens the default project file when it is missing", async() => {
      const root = await createRoot();
      const project = await StudioProject.open(root);

      assert.deepEqual(
        JSON.parse(
          await fs.readFile(path.join(root, PROJECT_FILE_PATH), "utf8")
        ),
        DEFAULT_PROJECT_FILE
      );
      assert.deepEqual(
        project.editors.descriptors().map((editor) => editor.name),
        ["pixel-art", "voxel-map", "voxel-model"]
      );
      assert.deepEqual(
        project.kinds.descriptors().map((descriptor) => descriptor.kind),
        ["pixelart", "blockset", "voxelmap", "voxelmodel", "voxelanimation"]
      );
    });

    test("opens the default project in memory without touching the root", async() => {
      const root = await createRoot();
      const project = await StudioProject.open(root, {
        inMemory: true
      });

      assert.deepEqual(project.file.document, DEFAULT_PROJECT_FILE);
      assert.deepEqual(await fs.readdir(root), []);
    });

    test("never overwrites an existing project file", async() => {
      const root = await createRoot();
      const file = await writeProjectFile(root, {
        version: 1
      });

      const project = await StudioProject.open(root);

      assert.deepEqual([...project.editors], []);
      assert.deepEqual(project.kinds.packages, []);
      assert.strictEqual(await fs.readFile(file, "utf8"), "{\"version\":1}");
    });

    test("names a missing editor package", async() => {
      const root = await createRoot();
      await writeProjectFile(root, {
        version: 1,
        editors: ["@jolly-pixel/missing-editor"]
      });

      await assert.rejects(
        StudioProject.open(root),
        {
          name: "TypeError",
          message: "Cannot locate the package \"@jolly-pixel/missing-editor\"."
        }
      );
    });

    test("names a missing kind package", async() => {
      const root = await createRoot();
      await writeProjectFile(root, {
        version: 1,
        kinds: {
          "@jolly-pixel/missing-kind": {}
        }
      });

      await assert.rejects(
        StudioProject.open(root),
        {
          name: "TypeError",
          message: "Cannot load the kind package \"@jolly-pixel/missing-kind\"."
        }
      );
    });

    test("names a kind package receiving invalid options", async() => {
      const root = await createRoot();
      await writeProjectFile(root, {
        version: 1,
        kinds: {
          "@jolly-pixel/asset.pixel-art": {
            defaultSize: 64
          }
        }
      });

      await assert.rejects(
        StudioProject.open(root),
        (error) => error instanceof TypeError && error.message.startsWith(
          "\"@jolly-pixel/asset.pixel-art\" received invalid options:"
        )
      );
    });

    test("names the project file when its editors are invalid", async() => {
      const root = await createRoot();
      const file = await writeProjectFile(root, {
        version: 1,
        editors: [""]
      });

      await assert.rejects(
        StudioProject.open(root),
        (error) => error instanceof TypeError &&
          error.message.startsWith(`"${file}" is invalid:`)
      );
    });
  });
});
