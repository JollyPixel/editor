// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import FindMyWay from "find-my-way";

// Import Internal Dependencies
import { HttpError } from "./errors/HttpError.ts";
import { HttpReply } from "./HttpReply.ts";
import { HttpRequest } from "./HttpRequest.ts";
import type {
  HttpMethod,
  HttpRoute
} from "./HttpRoute.ts";
import { isCrossOrigin } from "./origin.ts";
import { TrustedProxies } from "./TrustedProxies.ts";

export type HttpHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void
) => void;

export type HttpFailure = (error: unknown) => HttpError | null;

export interface HttpRouterOptions {
  prefix: string;
  routes: Iterable<HttpRoute>;
  proxies?: TrustedProxies;
  failure?: HttpFailure;
}

interface RouteMatch {
  route: HttpRoute;
  params: Record<string, string>;
}

export class HttpRouter {
  readonly handler: HttpHandler;

  #router = FindMyWay();
  #methods = new Set<HttpMethod>();
  #proxies: TrustedProxies;
  #failure: HttpFailure;

  constructor(
    options: HttpRouterOptions
  ) {
    for (const route of options.routes) {
      this.#router.on(
        route.method,
        `${options.prefix}${route.path}`,
        unusedHandler,
        route
      );
      this.#methods.add(route.method);
    }
    this.#proxies = options.proxies ?? new TrustedProxies();
    this.#failure = options.failure ?? (() => null);
    this.handler = (message, response, next) => {
      this.#dispatch(message, response, next);
    };
  }

  #dispatch(
    message: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void
  ): void {
    const url = URL.parse(message.url ?? "", "http://localhost");
    if (url === null) {
      next();

      return;
    }

    const matches = this.#match(url.pathname);
    if (matches.size === 0) {
      next();

      return;
    }

    this.#reply(message, url, matches)
      .then((reply) => reply.send(response))
      .catch(next);
  }

  #match(
    pathname: string
  ): Map<string, RouteMatch> {
    const matches = new Map<string, RouteMatch>();
    for (const method of this.#methods) {
      const found = this.#router.find(method, pathname);
      if (found !== null) {
        matches.set(method, {
          route: found.store,
          params: definedParams(found.params)
        });
      }
    }

    return matches;
  }

  async #reply(
    message: IncomingMessage,
    url: URL,
    matches: Map<string, RouteMatch>
  ): Promise<HttpReply> {
    try {
      if (isCrossOrigin(message.headers)) {
        throw new HttpError(
          403,
          "cross-origin",
          "the request comes from another origin"
        );
      }

      const match = matches.get(message.method ?? "");
      if (match === undefined) {
        const allowed = Array.from(matches.keys()).join(", ");
        throw new HttpError(
          405,
          "method-not-allowed",
          `expected ${allowed}`,
          {
            allow: allowed
          }
        );
      }

      return await match.route.handle(
        new HttpRequest(message, {
          url,
          params: match.params,
          proxies: this.#proxies
        })
      );
    }
    catch (error) {
      const failure = error instanceof HttpError ? error : this.#failure(error);
      if (failure === null) {
        throw error;
      }

      return HttpReply.failure(failure);
    }
  }
}

function unusedHandler(): void {
  throw new Error("routes are answered through HttpRouter, not lookup()");
}

function definedParams(
  params: Record<string, string | undefined>
): Record<string, string> {
  const defined: Record<string, string> = Object.create(null);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) {
      defined[name] = value;
    }
  }

  return defined;
}
