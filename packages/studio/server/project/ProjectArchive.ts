// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import {
  exportAssetArchive,
  type ArchiveBackend
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type { StudioAccess } from "./StudioAccess.ts";
import { ProjectExportRefusedError } from "./errors/ProjectExportRefusedError.ts";

// CONSTANTS
const kArchiveExtension = ".zip";

export interface ProjectArchiveOptions {
  access: StudioAccess;
  backend: ArchiveBackend;
  name: string;
}

export class ProjectArchive {
  readonly fileName: string;

  #access: StudioAccess;
  #backend: ArchiveBackend;

  constructor(
    options: ProjectArchiveOptions
  ) {
    this.#access = options.access;
    this.#backend = options.backend;
    this.fileName = `${options.name}${kArchiveExtension}`;
  }

  canExport(
    account: Account
  ): boolean {
    return this.#access.canExport(account.role);
  }

  async export(
    account: Account
  ): Promise<Uint8Array> {
    if (!this.canExport(account)) {
      throw new ProjectExportRefusedError();
    }

    const archive = await exportAssetArchive(this.#backend);
    if (!archive.ok) {
      throw archive.val;
    }

    return archive.val;
  }
}
