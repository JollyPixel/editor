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
import { Project } from "#src/project/node/Project.ts";
import { HostedProjects } from "#src/projects/node/HostedProjects.ts";
import { ProjectFolder } from "#src/projects/node/ProjectFolder.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kRoots: string[] = [];

describe("HostedProjects", () => {
  after(async() => {
    await Promise.all(kRoots.map((root) => removeTempDir(root)));
  });

  test("lists a project without an id as available, leaving its file untouched", async() => {
    const folder = await createTempDir("hosted-projects-");
    kRoots.push(folder);
    const file = path.join(folder, "castle", PROJECT_FILE_PATH);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ version: 1 }));
    await using projects = new HostedProjects({
      registry: new ProjectFolder(folder),
      openProject: (root) => Project.open(root),
      start: () => Promise.reject(new Error("listing starts no project"))
    });

    const statuses = await projects.statuses();

    assert.deepEqual(statuses, [{
      slug: "castle",
      id: null,
      unavailable: null
    }]);
    assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), {
      version: 1
    });
  });
});
