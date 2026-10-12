// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { ApiRequestError } from "./errors/ApiRequestError.ts";

// CONSTANTS
const kFailureSchema = z.object({
  message: z.string()
});

export interface ApiEndpointOptions {
  /**
   * Base URL of the handler, with a trailing slash.
   */
  url: string | URL;
  /**
   * @default globalThis.fetch
   */
  fetch?: typeof fetch;
}

export class ApiEndpoint {
  readonly url: URL;

  #fetch: typeof fetch;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.url = new URL(options.url);
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async send(
    path: string,
    init?: RequestInit
  ): Promise<Response> {
    const response = await this.#fetch(new URL(path, this.url), init);
    if (!response.ok) {
      const body = kFailureSchema.safeParse(
        await response.json().catch(() => null)
      );

      throw new ApiRequestError(
        response.status,
        body.data?.message ?? response.statusText
      );
    }

    return response;
  }
}
