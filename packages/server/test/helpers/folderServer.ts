// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type { JoinMode } from "@jolly-pixel/accounts";
import {
  PROJECT_FILE_PATH,
  type AssetSeedMap
} from "@jolly-pixel/asset-server";
import { ProjectFile } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { NO_SHELL_PREFERENCES } from "#src/preferences/PreferenceScopes.ts";
import { JollyServer } from "#src/server/node/JollyServer.ts";
import { ProjectHosting } from "#src/projects/node/ProjectHosting.ts";
import {
  projectsReplySchema,
  type ProjectSummary
} from "#src/projects/api.ts";
import {
  createDist,
  voxelMapProject,
  type Browser
} from "#src/testing.ts";
import { testSeed } from "./testProject.ts";
import {
  PUBLIC_HOST,
  createShell
} from "./jollyServer.ts";
import {
  createTempDir,
  removeTempDir
} from "./tempDir.ts";

// CONSTANTS
export const FOLDER_PASSWORD = "p".repeat(43);

export interface FolderOptions {
  ids?: Record<string, string>;
  editors?: Record<string, string>;
  seed?: AssetSeedMap;
}

export class FolderServers {
  static async create(): Promise<FolderServers> {
    const root = await createTempDir("studio-projects-");

    return new FolderServers(
      root,
      await createShell(root),
      await createDist()
    );
  }

  #root: string;
  #shell: string;
  #editorDist: string;

  constructor(
    root: string,
    shell: string,
    editorDist: string
  ) {
    this.#root = root;
    this.#shell = shell;
    this.#editorDist = editorDist;
  }

  async open(
    joins: Record<string, JoinMode>,
    options: FolderOptions = {}
  ): Promise<JollyServer> {
    const {
      ids = {},
      editors = {},
      seed = await testSeed()
    } = options;
    const projects = await fs.mkdtemp(path.join(this.#root, "projects-"));
    for (const slug of Object.keys(joins)) {
      const projectFile = path.join(projects, slug, PROJECT_FILE_PATH);
      await fs.mkdir(path.dirname(projectFile), { recursive: true });
      await fs.writeFile(projectFile, JSON.stringify({
        version: 1,
        id: ids[slug] ?? randomUUID()
      }));
    }

    return JollyServer.open({
      hosting: ProjectHosting.folder(projects),
      openProject: async(projectRoot) => {
        const onDisk = await ProjectFile.readOrCreate(projectRoot, {
          version: 1,
          id: randomUUID()
        });
        const project = voxelMapProject(projectRoot, this.#editorDist, {
          name: editors[path.basename(projectRoot)]
        });
        await project.file.replace({
          id: onDisk.data.id,
          access: {
            ...project.access.toJSON(),
            join: joins[path.basename(projectRoot)]
          }
        });

        return project;
      },
      shell: this.#shell,
      allowedHosts: [PUBLIC_HOST],
      backend: {
        inMemory: true,
        seed,
        preferences: NO_SHELL_PREFERENCES
      }
    });
  }

  async remove(): Promise<void> {
    await removeTempDir(this.#root);
    await removeTempDir(path.dirname(this.#editorDist));
  }
}

export function postJson(
  account: Browser,
  url: URL,
  body: unknown
): Promise<Response> {
  return account.fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function listProjects(
  account: Browser,
  url: URL
): Promise<ProjectSummary[]> {
  const response = await account.fetch(url);

  return projectsReplySchema.parse(await response.json()).projects;
}
