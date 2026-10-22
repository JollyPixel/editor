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
import rateLimit from "@fastify/rate-limit";
import type * as z from "zod";
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import {
  isCrossOrigin,
  type Accounts
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { accountsRoutes } from "./accounts/accountsRoutes.ts";
import { auditRoutes } from "./audit/auditRoutes.ts";
import { ApiError } from "./errors/ApiError.ts";
import { preferencesRoutes } from "./preferences/preferencesRoutes.ts";
import { projectRoutes } from "./project/projectRoutes.ts";
import { sharesRoutes } from "./shares/sharesRoutes.ts";
import type { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import { PREFERENCES_URL_PATH } from "../../shared/api/preferences.ts";
import { AUDIT_URL_PATH } from "../../shared/api/audit.ts";
import { PROJECT_URL_PATH } from "../../shared/api/project.ts";
import { SHARES_URL_PATH } from "../../shared/api/shares.ts";
import type { AuditFeed } from "../audit/AuditFeed.ts";
import type { ProjectArchive } from "../project/ProjectArchive.ts";
import type { ProjectSettings } from "../project/ProjectSettings.ts";
import type { StudioShares } from "../shares/StudioShares.ts";

// CONSTANTS
export const API_URL_PATH = "/api/";
const kMaxBodyBytes = 4 * 1_024;
const kPayloadTooLarge = 413;
const kDefaultRequestsPerMinute = 300;

export type ApiMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export type TrustProxy = boolean | string | string[];

export interface StudioApiOptions {
  accounts: Accounts;
  shares: StudioShares;
  archive: ProjectArchive;
  settings: ProjectSettings;
  audit: AuditFeed;
  preferences: PreferenceScopes;
  requestsPerMinute?: number;
  trustProxy?: TrustProxy;
}

export class StudioApi implements AsyncDisposable {
  static async open(
    options: StudioApiOptions
  ): Promise<StudioApi> {
    const app = Fastify({
      bodyLimit: kMaxBodyBytes,
      trustProxy: options.trustProxy ?? false,
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

    app.setValidatorCompiler<z.ZodType>(({ schema }) => (data) => {
      const parsed = schema.safeParse(data);

      return parsed.success ?
        { value: parsed.data } :
        { error: parsed.error };
    });
    await app.register(rateLimit, {
      max: options.requestsPerMinute ?? kDefaultRequestsPerMinute,
      timeWindow: 60_000,
      errorResponseBuilder: (_request, context) => new ApiError(
        context.statusCode,
        "throttled",
        "too many requests",
        {
          "retry-after": String(Math.ceil(context.ttl / 1_000))
        }
      )
    });
    await app.register(accountsRoutes, {
      prefix: ACCOUNTS_URL_PATH,
      accounts: options.accounts
    });
    await app.register(sharesRoutes, {
      prefix: SHARES_URL_PATH,
      accounts: options.accounts,
      shares: options.shares
    });
    await app.register(projectRoutes, {
      prefix: PROJECT_URL_PATH,
      accounts: options.accounts,
      archive: options.archive,
      settings: options.settings
    });
    await app.register(auditRoutes, {
      prefix: AUDIT_URL_PATH,
      accounts: options.accounts,
      feed: options.audit
    });
    await app.register(preferencesRoutes, {
      prefix: PREFERENCES_URL_PATH,
      accounts: options.accounts,
      scopes: options.preferences
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
