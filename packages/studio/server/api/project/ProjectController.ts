// Import Third-party Dependencies
import type {
  FastifyReply,
  FastifyRequest
} from "fastify";
import { AccountsError } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";
import { ARCHIVE_MIME_TYPE } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { ApiError } from "../errors/ApiError.ts";
import { accountsFailure } from "../errors/accountsFailure.ts";
import { requireAccount } from "../requireAccount.ts";
import { AttachmentDisposition } from "../../../shared/AttachmentDisposition.ts";
import type {
  AccessChange,
  KindOptions,
  ProjectReply,
  ProjectSettingsReply
} from "../../../shared/api/project.ts";
import type { ProjectArchive } from "../../project/ProjectArchive.ts";
import type { ProjectSettings } from "../../project/ProjectSettings.ts";
import { InvalidSettingsError } from "../../project/errors/InvalidSettingsError.ts";
import { ProjectExportRefusedError } from "../../project/errors/ProjectExportRefusedError.ts";
import { RoleInUseError } from "../../project/errors/RoleInUseError.ts";
import { SettingsRefusedError } from "../../project/errors/SettingsRefusedError.ts";

export interface ReplaceKindsRoute {
  Body: KindOptions;
}

export interface ReplaceAccessRoute {
  Body: AccessChange;
}

export class ProjectController {
  #accounts: Accounts;
  #archive: ProjectArchive;
  #settings: ProjectSettings;

  constructor(
    accounts: Accounts,
    archive: ProjectArchive,
    settings: ProjectSettings
  ) {
    this.#accounts = accounts;
    this.#archive = archive;
    this.#settings = settings;
  }

  access(
    request: FastifyRequest
  ): ProjectReply {
    return this.#settings.rights(requireAccount(this.#accounts, request));
  }

  async archive(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const bytes = await this.#archive.export(
      requireAccount(this.#accounts, request)
    );
    const disposition = new AttachmentDisposition(this.#archive.fileName);

    return reply
      .type(ARCHIVE_MIME_TYPE)
      .header("content-disposition", disposition.toString())
      .send(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  }

  settings(
    request: FastifyRequest
  ): ProjectSettingsReply {
    return this.#settings.read(requireAccount(this.#accounts, request));
  }

  replaceKinds(
    request: FastifyRequest<ReplaceKindsRoute>
  ): Promise<ProjectSettingsReply> {
    return this.#settings.replaceKinds(
      requireAccount(this.#accounts, request),
      request.body
    );
  }

  replaceAccess(
    request: FastifyRequest<ReplaceAccessRoute>
  ): Promise<ProjectSettingsReply> {
    return this.#settings.replaceAccess(
      requireAccount(this.#accounts, request),
      request.body
    );
  }

  failure(
    error: unknown
  ): unknown {
    if (error instanceof AccountsError) {
      return accountsFailure(error);
    }
    if (error instanceof ProjectExportRefusedError) {
      return new ApiError(403, "export-refused", error.message);
    }
    if (error instanceof SettingsRefusedError) {
      return new ApiError(403, "settings-refused", error.message);
    }
    if (error instanceof InvalidSettingsError) {
      return new ApiError(400, "invalid-settings", error.message);
    }
    if (error instanceof RoleInUseError) {
      return new ApiError(409, "role-in-use", error.message);
    }

    return error;
  }
}
