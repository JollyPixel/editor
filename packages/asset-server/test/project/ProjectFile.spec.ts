// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import { PROJECT_FILE_PATH } from "#src/index.ts";
import {
  ProjectFile,
  type ProjectFileData
} from "#src/node.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";

describe("ProjectFile", () => {
  test("reads a missing file as a project without kinds", async() => {
    await using workspace = await tempWorkspace();
    const file = await ProjectFile.read(workspace.root);

    assert.strictEqual(file.path, path.join(workspace.root, PROJECT_FILE_PATH));
    assert.deepEqual(file.document, { version: 1 });
    assert.strictEqual(file.kinds.size, 0);
  });

  test("reads the kinds and keeps the host sections", async() => {
    await using workspace = await tempWorkspace();
    const file = path.join(workspace.root, PROJECT_FILE_PATH);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({
      version: 1,
      editors: ["editor-a"],
      kinds: {
        "kind-b": {
          size: 8
        },
        "kind-a": {}
      }
    }));

    const projectFile = await ProjectFile.read(workspace.root);

    assert.deepEqual(
      [...projectFile.kinds],
      [
        ["kind-b", { size: 8 }],
        ["kind-a", {}]
      ]
    );
    assert.deepEqual(projectFile.document.editors, ["editor-a"]);
  });

  test("creates a missing file with the given data", async() => {
    await using workspace = await tempWorkspace();
    const data: ProjectFileData = {
      version: 1,
      kinds: {
        "kind-a": {
          size: 8
        }
      }
    };

    const projectFile = await ProjectFile.readOrCreate(workspace.root, data);

    assert.deepEqual(
      JSON.parse(await fs.readFile(projectFile.path, "utf8")),
      data
    );
    assert.deepEqual(projectFile.document, data);
  });

  test("never overwrites an existing file", async() => {
    await using workspace = await tempWorkspace();
    const file = path.join(workspace.root, PROJECT_FILE_PATH);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "{\"version\":1}");

    const projectFile = await ProjectFile.readOrCreate(workspace.root, {
      version: 1,
      kinds: {
        "kind-a": {}
      }
    });

    assert.strictEqual(projectFile.kinds.size, 0);
    assert.strictEqual(await fs.readFile(file, "utf8"), "{\"version\":1}");
  });

  test("opens the file on disk, creating it when missing", async() => {
    await using workspace = await tempWorkspace();
    const data: ProjectFileData = {
      version: 1,
      kinds: {
        "kind-a": {}
      }
    };

    const projectFile = await ProjectFile.open(workspace.root, data);

    assert.deepEqual(
      JSON.parse(await fs.readFile(projectFile.path, "utf8")),
      data
    );
  });

  test("is stale only when the file on disk holds another document", async() => {
    await using workspace = await tempWorkspace();
    const projectFile = await ProjectFile.readOrCreate(workspace.root, {
      version: 1
    });

    assert.strictEqual(await projectFile.isStale(), false);

    await fs.writeFile(projectFile.path, "{ \"version\": 1 }\n");
    assert.strictEqual(await projectFile.isStale(), false);

    await fs.writeFile(projectFile.path, "{\"version\":1,\"editors\":[]}");
    assert.strictEqual(await projectFile.isStale(), true);

    await fs.writeFile(projectFile.path, "{");
    assert.strictEqual(await projectFile.isStale(), true);

    await fs.rm(projectFile.path);
    assert.strictEqual(await projectFile.isStale(), true);
  });

  test("opens in memory without reading or writing the root", async() => {
    await using workspace = await tempWorkspace();
    const file = path.join(workspace.root, PROJECT_FILE_PATH);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "{\"version\":1}");

    const projectFile = await ProjectFile.open(
      workspace.root,
      {
        version: 1,
        kinds: {
          "kind-a": {}
        }
      },
      { inMemory: true }
    );

    assert.deepEqual([...projectFile.kinds.keys()], ["kind-a"]);
    assert.strictEqual(await fs.readFile(file, "utf8"), "{\"version\":1}");
  });

  test("names the file when it is invalid", () => {
    const documents = [
      "{",
      "[]",
      JSON.stringify({ kinds: {} }),
      JSON.stringify({ version: 2 }),
      JSON.stringify({ version: 1, kinds: { "kind-a": 1 } })
    ];
    const root = path.resolve("project");

    for (const document of documents) {
      assert.throws(
        () => ProjectFile.parse(root, document),
        (error) => error instanceof TypeError &&
          error.message.includes(path.join(root, PROJECT_FILE_PATH)),
        document
      );
    }
  });
});
