// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Import Third-party Dependencies
import { createServer } from "vite";
import type { JoinMode } from "@jolly-pixel/accounts";
import { PROJECT_FILE_PATH } from "@jolly-pixel/asset-server";
import { PORTS } from "@jolly-pixel/e2e";
import {
  DEFAULT_ACCESS,
  PROJECTS_FOLDER_ENV
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { STUDIO_PROJECT_FILE } from "../../../node/projectTemplate.ts";
import { STUDIO_ROOT } from "../../../node/studioFiles.ts";
import { SEEDED_PROJECTS } from "./seededProjects.ts";

// CONSTANTS
const kCacheDir = path.join("node_modules", ".vite-e2e-projects");

const folder = await fs.mkdtemp(path.join(os.tmpdir(), "studio-e2e-projects-"));
const castleId = randomUUID();
await writeProject(SEEDED_PROJECTS.castle, castleId, "open");
await writeProject(SEEDED_PROJECTS.copy, castleId, "open");
await writeProject(SEEDED_PROJECTS.forest, randomUUID(), "request");

process.env[PROJECTS_FOLDER_ENV] = folder;
const server = await createServer({
  root: STUDIO_ROOT,
  mode: "e2e",
  cacheDir: kCacheDir,
  server: {
    port: PORTS.studioProjects
  }
});
await server.listen();
server.printUrls();

async function writeProject(
  slug: string,
  id: string,
  join: JoinMode
): Promise<void> {
  const file = path.join(folder, slug, PROJECT_FILE_PATH);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({
    ...STUDIO_PROJECT_FILE,
    id,
    access: {
      ...DEFAULT_ACCESS,
      defaultRole: "member",
      join
    }
  }));
}
