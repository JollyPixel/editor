// Import Third-party Dependencies
import type * as z from "zod";

// Import Internal Dependencies
import { ApiRequestError } from "./errors/ApiRequestError.ts";
import { MissingRouteParamError } from "./errors/MissingRouteParamError.ts";
import {
  apiFailureSchema,
  type ApiRoute
} from "../../shared/api/common.ts";

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

export interface ApiRequest {
  /**
   * Values of the route's `:name` segments.
   */
  params?: Readonly<Record<string, string>>;
  /**
   * Search parameters; `undefined` values are left out.
   */
  query?: Readonly<Record<string, string | number | undefined>>;
  /**
   * Sent as JSON.
   */
  body?: unknown;
  keepalive?: boolean;
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
    route: ApiRoute,
    request: ApiRequest = {}
  ): Promise<Response> {
    const response = await this.#fetch(this.#urlTo(route, request), {
      method: route.method,
      keepalive: request.keepalive,
      ...(request.body === undefined ?
        {} :
        {
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(request.body)
        })
    });
    if (!response.ok) {
      const failure = apiFailureSchema.safeParse(
        await response.json().catch(() => null)
      );

      throw new ApiRequestError(
        response.status,
        failure.data?.message ?? response.statusText
      );
    }

    return response;
  }

  async json<T>(
    route: ApiRoute,
    schema: z.ZodType<T>,
    request: ApiRequest = {}
  ): Promise<T> {
    const response = await this.send(route, request);

    return schema.parse(await response.json());
  }

  #urlTo(
    route: ApiRoute,
    request: ApiRequest
  ): URL {
    const path = route.path.replace(/:(\w+)/g, (_segment, name: string) => {
      const value = request.params?.[name];
      if (value === undefined) {
        throw new MissingRouteParamError(route.path, name);
      }

      return encodeURIComponent(value);
    });
    const url = new URL(path, this.url);
    for (const [name, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(name, String(value));
      }
    }

    return url;
  }
}
