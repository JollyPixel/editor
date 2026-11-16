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
import { ProjectFolder } from "#src/projects/node/ProjectFolder.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kRoots: string[] = [];

async function projectsFolder(
  ...slugs: string[]
): Promise<string> {
  const folder = await createTempDir("project-folder-");
  kRoots.push(folder);
  for (const slug of slugs) {
    await writeProject(folder, slug);
  }

  return folder;
}

async function writeProject(
  folder: string,
  slug: string
): Promise<void> {
  const file = path.join(folder, slug, PROJECT_FILE_PATH);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ version: 1 }));
}

describe("ProjectFolder", () => {
  after(async() => {
    await Promise.all(kRoots.map((root) => removeTempDir(root)));
  });

  test("resolves a project folder added after it started", async() => {
    const folder = await projectsFolder("castle");
    const projects = new ProjectFolder(folder);
    assert.equal(await projects.resolve("forest"), null);

    await writeProject(folder, "forest");

    assert.equal(await projects.resolve("forest"), path.join(folder, "forest"));
    assert.deepEqual(
      (await projects.list()).map((entry) => entry.slug),
      ["castle", "forest"]
    );
  });

  test("skips folders without a project file and slugs that leave the folder", async() => {
    const folder = await projectsFolder("castle");
    await fs.mkdir(path.join(folder, "notes"));
    const projects = new ProjectFolder(folder);

    assert.equal(await projects.resolve("notes"), null);
    assert.equal(await projects.resolve(".."), null);
    assert.equal(await projects.resolve("castle/.."), null);
    assert.deepEqual(
      (await projects.list()).map((entry) => entry.slug),
      ["castle"]
    );
  });
});
