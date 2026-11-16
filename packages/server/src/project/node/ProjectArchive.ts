// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";
import {
  exportAssetArchive,
  type ArchiveBackend
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type { Project } from "./Project.ts";

// CONSTANTS
const kArchiveExtension = ".zip";

export interface ProjectArchiveOptions {
  project: Pick<Project, "access" | "name">;
  backend: ArchiveBackend;
}

export class ProjectArchive {
  readonly fileName: string;

  #project: Pick<Project, "access">;
  #backend: ArchiveBackend;

  constructor(
    options: ProjectArchiveOptions
  ) {
    this.#project = options.project;
    this.#backend = options.backend;
    this.fileName = `${options.project.name}${kArchiveExtension}`;
  }

  async export(
    account: Member
  ): Promise<Uint8Array> {
    this.#project.access.projectRights(account.role).require("export");

    const archive = await exportAssetArchive(this.#backend);
    if (!archive.ok) {
      throw archive.val;
    }

    return archive.val;
  }
}
