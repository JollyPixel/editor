// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import {
  exportAssetArchive,
  type ArchiveBackend
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type { StudioProject } from "./StudioProject.ts";

// CONSTANTS
const kArchiveExtension = ".zip";

export interface ProjectArchiveOptions {
  project: Pick<StudioProject, "access">;
  backend: ArchiveBackend;
  name: string;
}

export class ProjectArchive {
  readonly fileName: string;

  #project: Pick<StudioProject, "access">;
  #backend: ArchiveBackend;

  constructor(
    options: ProjectArchiveOptions
  ) {
    this.#project = options.project;
    this.#backend = options.backend;
    this.fileName = `${options.name}${kArchiveExtension}`;
  }

  async export(
    account: Account
  ): Promise<Uint8Array> {
    this.#project.access.projectRights(account.role).require("export");

    const archive = await exportAssetArchive(this.#backend);
    if (!archive.ok) {
      throw archive.val;
    }

    return archive.val;
  }
}
