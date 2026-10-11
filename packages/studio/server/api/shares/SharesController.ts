// Import Third-party Dependencies
import type {
  FastifyReply,
  FastifyRequest
} from "fastify";
import { AccountsError } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ApiError } from "../errors/ApiError.ts";
import { accountsFailure } from "../errors/accountsFailure.ts";
import { requireAccount } from "../requireAccount.ts";
import { ShareLifetime } from "../../../src/shares/ShareLifetime.ts";
import type {
  CreateShareBody,
  CreatedShareReply,
  ShareLinksReply
} from "../../../src/shares/routes.ts";
import type { StudioShares } from "../../shares/StudioShares.ts";
import { UnknownAssetError } from "../../shares/errors/UnknownAssetError.ts";

export interface CreateShareRoute {
  Body: CreateShareBody;
}

export interface RevokeShareRoute {
  Params: {
    linkId: string;
  };
}

export class SharesController {
  #accounts: Accounts;
  #shares: StudioShares;

  constructor(
    accounts: Accounts,
    shares: StudioShares
  ) {
    this.#accounts = accounts;
    this.#shares = shares;
  }

  async create(
    request: FastifyRequest<CreateShareRoute>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const link = await this.#shares.create(
      requireAccount(this.#accounts, request),
      request.body.assetId,
      new ShareLifetime(request.body.lifetime)
    );

    return reply.code(201).send({
      link
    } satisfies CreatedShareReply);
  }

  list(
    request: FastifyRequest
  ): ShareLinksReply {
    const account = requireAccount(this.#accounts, request);

    return {
      links: this.#accounts.shareLinks.visibleTo(account.id),
      canShare: this.#shares.canShare(account)
    };
  }

  revoke(
    request: FastifyRequest<RevokeShareRoute>,
    reply: FastifyReply
  ): FastifyReply {
    this.#accounts.shareLinks.revoke(
      requireAccount(this.#accounts, request).id,
      request.params.linkId
    );

    return reply.code(204).send();
  }

  failure(
    error: unknown
  ): unknown {
    if (error instanceof AccountsError) {
      return accountsFailure(error);
    }
    if (error instanceof UnknownAssetError) {
      return new ApiError(404, "not-found", error.message);
    }

    return error;
  }
}
