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
import { tempDirectory } from "../../helpers/tempDirectory.ts";

describe("ProjectFile", () => {
  test("reads a missing file as a project without kinds", async() => {
    await using directory = await tempDirectory();
    const file = await ProjectFile.read(directory.root);

    assert.strictEqual(file.path, path.join(directory.root, PROJECT_FILE_PATH));
    assert.deepEqual(file.data, { version: 1 });
    assert.strictEqual(file.kinds.size, 0);
  });

  test("reads the kinds and keeps the host sections", async() => {
    await using directory = await tempDirectory();
    const file = path.join(directory.root, PROJECT_FILE_PATH);
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

    const projectFile = await ProjectFile.read(directory.root);

    assert.deepEqual(
      [...projectFile.kinds],
      [
        ["kind-b", { size: 8 }],
        ["kind-a", {}]
      ]
    );
    assert.deepEqual(projectFile.data.editors, ["editor-a"]);
  });

  test("never overwrites an existing file", async() => {
    await using directory = await tempDirectory();
    const file = path.join(directory.root, PROJECT_FILE_PATH);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "{\"version\":1}");

    const projectFile = await ProjectFile.readOrCreate(directory.root, {
      version: 1,
      kinds: {
        "kind-a": {}
      }
    });

    assert.strictEqual(projectFile.kinds.size, 0);
    assert.strictEqual(await fs.readFile(file, "utf8"), "{\"version\":1}");
  });

  test("opens the file on disk, creating it when missing", async() => {
    await using directory = await tempDirectory();
    const data: ProjectFileData = {
      version: 1,
      kinds: {
        "kind-a": {
          size: 8
        }
      }
    };

    const projectFile = await ProjectFile.open(directory.root, data);

    assert.deepEqual(
      JSON.parse(await fs.readFile(projectFile.path, "utf8")),
      data
    );
    assert.deepEqual(projectFile.data, data);
  });

  test("is stale only when the file on disk holds another document", async() => {
    await using directory = await tempDirectory();
    const projectFile = await ProjectFile.readOrCreate(directory.root, {
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
    await using directory = await tempDirectory();
    const file = path.join(directory.root, PROJECT_FILE_PATH);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "{\"version\":1}");

    const projectFile = await ProjectFile.open(
      directory.root,
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

  test("replace writes one section and keeps the file fresh", async() => {
    await using directory = await tempDirectory();
    const projectFile = await ProjectFile.readOrCreate(directory.root, {
      version: 1,
      editors: ["editor-a"]
    });

    await projectFile.replace("kinds", { "kind-a": { size: 8 } });

    const expected = {
      version: 1,
      editors: ["editor-a"],
      kinds: { "kind-a": { size: 8 } }
    };
    assert.deepEqual(
      JSON.parse(await fs.readFile(projectFile.path, "utf8")),
      expected
    );
    assert.deepEqual(projectFile.data, expected);
    assert.deepEqual([...projectFile.kinds.keys()], ["kind-a"]);
    assert.strictEqual(await projectFile.isStale(), false);
  });

  test("replace refuses an invalid section and keeps the document", async() => {
    await using directory = await tempDirectory();
    const projectFile = await ProjectFile.readOrCreate(directory.root, {
      version: 1
    });

    await assert.rejects(
      projectFile.replace("kinds", { "kind-a": 1 }),
      TypeError
    );

    assert.deepEqual(projectFile.data, { version: 1 });
    assert.strictEqual(await projectFile.isStale(), false);
  });
});
