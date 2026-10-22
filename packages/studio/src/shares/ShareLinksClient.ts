// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  SHARES_ROUTES,
  createdShareReplySchema,
  shareLinksReplySchema,
  type CreatedShareReply,
  type ShareLinksReply
} from "../../shared/api/shares.ts";
import type { ShareLifetimeName } from "../../shared/ShareLifetime.ts";

export class ShareLinksClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  list(): Promise<ShareLinksReply> {
    return this.#endpoint.json(SHARES_ROUTES.list, shareLinksReplySchema);
  }

  create(
    assetId: string,
    lifetime: ShareLifetimeName
  ): Promise<CreatedShareReply> {
    return this.#endpoint.json(SHARES_ROUTES.create, createdShareReplySchema, {
      body: {
        assetId,
        lifetime
      }
    });
  }

  async revoke(
    linkId: string
  ): Promise<void> {
    await this.#endpoint.send(SHARES_ROUTES.revoke, {
      params: {
        linkId
      }
    });
  }
}
