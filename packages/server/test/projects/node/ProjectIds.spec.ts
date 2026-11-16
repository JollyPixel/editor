// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
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
import { DuplicateProjectError } from "#src/projects/node/errors/DuplicateProjectError.ts";
import { ProjectIds } from "#src/projects/node/ProjectIds.ts";
import { ProjectFolder } from "#src/projects/node/ProjectFolder.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kRoots: string[] = [];

async function writeProject(
  folder: string,
  slug: string,
  id: string
): Promise<void> {
  const file = path.join(folder, slug, PROJECT_FILE_PATH);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ version: 1, id }));
}

describe("ProjectIds", () => {
  after(async() => {
    await Promise.all(kRoots.map((root) => removeTempDir(root)));
  });

  test("refuses a copied folder until the first one changes its id", async() => {
    const folder = await createTempDir("project-ids-");
    kRoots.push(folder);
    const id = randomUUID();
    await writeProject(folder, "castle", id);
    await writeProject(folder, "castle-copy", id);
    const ids = new ProjectIds(new ProjectFolder(folder));

    await ids.claim(id, "castle");
    await assert.rejects(ids.claim(id, "castle-copy"), DuplicateProjectError);

    await writeProject(folder, "castle", randomUUID());
    await ids.claim(id, "castle-copy");
  });
});
