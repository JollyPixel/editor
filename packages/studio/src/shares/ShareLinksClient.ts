// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { ShareRequestError } from "./errors/ShareRequestError.ts";
import {
  createdShareReplySchema,
  shareLinksReplySchema,
  type CreatedShareReply,
  type ShareLinksReply
} from "./routes.ts";
import type { ShareLifetimeName } from "./ShareLifetime.ts";

// CONSTANTS
const kFailureSchema = z.object({
  message: z.string()
});

export interface ShareLinksClientOptions {
  /**
   * Base URL of the shares handler, with a trailing slash.
   */
  url: string | URL;
  /**
   * @default globalThis.fetch
   */
  fetch?: typeof fetch;
}

export class ShareLinksClient {
  readonly url: URL;

  #fetch: typeof fetch;

  constructor(
    options: ShareLinksClientOptions
  ) {
    this.url = new URL(options.url);
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async list(): Promise<ShareLinksReply> {
    const response = await this.#send(this.url);

    return shareLinksReplySchema.parse(await response.json());
  }

  async create(
    assetId: string,
    lifetime: ShareLifetimeName
  ): Promise<CreatedShareReply> {
    const response = await this.#send(this.url, {
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
    await this.#send(
      new URL(encodeURIComponent(linkId), this.url),
      {
        method: "DELETE"
      }
    );
  }

  async #send(
    url: URL,
    init?: RequestInit
  ): Promise<Response> {
    const response = await this.#fetch(url, init);
    if (!response.ok) {
      const body = kFailureSchema.safeParse(
        await response.json().catch(() => null)
      );

      throw new ShareRequestError(
        response.status,
        body.data?.message ?? response.statusText
      );
    }

    return response;
  }
}
