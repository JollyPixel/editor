// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply
} from "fastify";
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import {
  isCrossOrigin,
  type Accounts
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { accountsRoutes } from "./accounts/accountsRoutes.ts";
import { ApiError } from "./errors/ApiError.ts";

// CONSTANTS
export const API_URL_PATH = "/api/";
const kMaxBodyBytes = 4 * 1_024;
const kPayloadTooLarge = 413;

export type ApiMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface StudioApiOptions {
  accounts: Accounts;
  requestsPerMinute?: number;
}

export class StudioApi implements AsyncDisposable {
  static async open(
    options: StudioApiOptions
  ): Promise<StudioApi> {
    const app = Fastify({
      bodyLimit: kMaxBodyBytes,
      logger: {
        level: "error"
      }
    });

    app.addHook("onRequest", async(request, reply) => {
      reply.header("cache-control", "no-store");
      if (isCrossOrigin(request.headers)) {
        throw new ApiError(
          403,
          "cross-origin",
          "the request comes from another origin"
        );
      }
    });

    app.setNotFoundHandler(async() => {
      throw new ApiError(
        404,
        "not-found",
        "no route answers this request"
      );
    });

    app.setErrorHandler((error: FastifyError, _request, reply) => {
      const failure = apiFailure(error);
      if (failure === null) {
        throw error;
      }

      return sendFailure(reply, failure);
    });

    await app.register(accountsRoutes, {
      prefix: ACCOUNTS_URL_PATH,
      accounts: options.accounts,
      requestsPerMinute: options.requestsPerMinute
    });
    await app.ready();

    return new StudioApi(app);
  }

  readonly middleware: ApiMiddleware;

  #app: FastifyInstance;

  private constructor(
    app: FastifyInstance
  ) {
    this.#app = app;
    this.middleware = (request, response, next) => {
      if (request.url?.startsWith(API_URL_PATH)) {
        this.#app.routing(request, response);
      }
      else {
        next();
      }
    };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#app.close();
  }
}

function apiFailure(
  error: FastifyError
): ApiError | null {
  if (error instanceof ApiError) {
    return error;
  }

  if (error.statusCode === kPayloadTooLarge) {
    return new ApiError(
      kPayloadTooLarge,
      "payload-too-large",
      "the request body is too large"
    );
  }

  if (
    error.statusCode !== undefined &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return new ApiError(
      error.statusCode,
      "invalid-request",
      "the request is malformed"
    );
  }

  return null;
}

function sendFailure(
  reply: FastifyReply,
  failure: ApiError
): FastifyReply {
  return reply
    .code(failure.status)
    .headers(failure.headers)
    .send({
      code: failure.code,
      message: failure.message
    });
}
