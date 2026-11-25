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
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { ProjectFolder } from "#src/projects/node/ProjectFolder.ts";
import { ProjectFolderError } from "#src/projects/node/errors/ProjectFolderError.ts";
import { UnknownProjectError } from "#src/projects/node/errors/UnknownProjectError.ts";
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

  test("skips folders without a project file, slugs leaving the folder and other cases", async() => {
    const folder = await projectsFolder("castle");
    await fs.mkdir(path.join(folder, "notes"));
    const projects = new ProjectFolder(folder);

    assert.equal(await projects.resolve("notes"), null);
    assert.equal(await projects.resolve(".."), null);
    assert.equal(await projects.resolve("castle/.."), null);
    assert.equal(await projects.resolve("CASTLE"), null);
    assert.deepEqual(
      (await projects.list()).map((entry) => entry.slug),
      ["castle"]
    );
  });

  test("renames a project folder, refusing a taken name or one that cannot name a project", async() => {
    const folder = await projectsFolder("castle", "forest");
    const projects = new ProjectFolder(folder);

    const renamed = await projects.rename("castle", "fortress");

    assert.equal(renamed, path.join(folder, "fortress"));
    assert.deepEqual(
      (await projects.list()).map((entry) => entry.slug),
      ["forest", "fortress"]
    );
    await assert.rejects(projects.rename("forest", "fortress"), ProjectFolderError);
    await assert.rejects(projects.rename("forest", "../moon"), ProjectFolderError);
    await assert.rejects(projects.rename("castle", "moon"), UnknownProjectError);
  });

  test("moves a removed project to the trash of its state folder", async() => {
    const folder = await projectsFolder("castle", "forest");
    const projects = new ProjectFolder(folder);

    await projects.remove("castle");

    const trash = await fs.readdir(path.join(folder, STATE_DIRECTORY, "trash"));
    assert.equal(trash.length, 1);
    assert.match(trash[0], /^castle-/);
    assert.deepEqual(
      (await projects.list()).map((entry) => entry.slug),
      ["forest"]
    );
    await assert.rejects(projects.remove("castle"), UnknownProjectError);
  });
});
