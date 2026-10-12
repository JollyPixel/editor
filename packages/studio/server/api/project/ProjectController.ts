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
import { AttachmentDisposition } from "../../../src/project/AttachmentDisposition.ts";
import type { ProjectReply } from "../../../src/project/routes.ts";
import type { ProjectArchive } from "../../project/ProjectArchive.ts";
import { ProjectExportRefusedError } from "../../project/errors/ProjectExportRefusedError.ts";

export class ProjectController {
  #accounts: Accounts;
  #archive: ProjectArchive;

  constructor(
    accounts: Accounts,
    archive: ProjectArchive
  ) {
    this.#accounts = accounts;
    this.#archive = archive;
  }

  access(
    request: FastifyRequest
  ): ProjectReply {
    return {
      canExport: this.#archive.canExport(
        requireAccount(this.#accounts, request)
      )
    };
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

  failure(
    error: unknown
  ): unknown {
    if (error instanceof AccountsError) {
      return accountsFailure(error);
    }
    if (error instanceof ProjectExportRefusedError) {
      return new ApiError(403, "export-refused", error.message);
    }

    return error;
  }
}
