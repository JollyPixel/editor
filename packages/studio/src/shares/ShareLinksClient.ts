// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  createdShareReplySchema,
  shareLinksReplySchema,
  type CreatedShareReply,
  type ShareLinksReply
} from "./routes.ts";
import type { ShareLifetimeName } from "./ShareLifetime.ts";

export class ShareLinksClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async list(): Promise<ShareLinksReply> {
    const response = await this.#endpoint.send("");

    return shareLinksReplySchema.parse(await response.json());
  }

  async create(
    assetId: string,
    lifetime: ShareLifetimeName
  ): Promise<CreatedShareReply> {
    const response = await this.#endpoint.send("", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        assetId,
        lifetime
      })
    });

    return createdShareReplySchema.parse(await response.json());
  }

  async revoke(
    linkId: string
  ): Promise<void> {
    await this.#endpoint.send(encodeURIComponent(linkId), {
      method: "DELETE"
    });
  }
}
