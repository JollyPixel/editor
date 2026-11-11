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
import { accountsRoutes } from "../accounts/routes.ts";
import { auditRoutes } from "../audit/routes.ts";
import { gameRoutes } from "../game/routes.ts";
import { authenticate } from "./authentication.ts";
import { ApiError } from "./errors/ApiError.ts";
import { apiFailure } from "./apiFailure.ts";
import type { Middleware } from "./Middleware.ts";
import { preferencesRoutes } from "../preferences/routes.ts";
import { projectRoutes } from "../project/routes.ts";
import { sharesRoutes } from "../shares/routes.ts";
import type { PreferenceScopes } from "../../preferences/PreferenceScopes.ts";
import type { ApiFailure } from "../../http/api.ts";
import { PREFERENCES_URL_PATH } from "../../preferences/api.ts";
import { AUDIT_URL_PATH } from "../../audit/api.ts";
import { GAME_URL_PATH } from "../../game/api.ts";
import { PROJECT_URL_PATH } from "../../project/api.ts";
import { SHARES_URL_PATH } from "../../shares/api.ts";
import type { AuditFeed } from "../audit/AuditFeed.ts";
import type { GameExport } from "../game/GameExport.ts";
import type { StudioGame } from "../game/StudioGame.ts";
import { StoredPreferences } from "../preferences/StoredPreferences.ts";
import type { ProjectArchive } from "../project/ProjectArchive.ts";
import type { ProjectSettings } from "../project/ProjectSettings.ts";
import type { StudioShares } from "../shares/StudioShares.ts";

// CONSTANTS
export const API_URL_PATH = "/api/";
const kMaxBodyBytes = 4 * 1_024;
const kDefaultRequestsPerMinute = 300;

export type TrustProxy = boolean | string | string[];

export interface StudioApiOptions {
  accounts: Accounts;
  shares: StudioShares;
  archive: ProjectArchive;
  gameExport: GameExport;
  settings: ProjectSettings;
  audit: AuditFeed;
  game: StudioGame;
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

    app.decorateRequest("account", null);
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
    await app.register(async(signedIn) => {
      signedIn.addHook("preParsing", authenticate(options.accounts));

      await signedIn.register(sharesRoutes, {
        prefix: SHARES_URL_PATH,
        shares: options.shares
      });
      await signedIn.register(projectRoutes, {
        prefix: PROJECT_URL_PATH,
        archive: options.archive,
        gameExport: options.gameExport,
        settings: options.settings
      });
      await signedIn.register(auditRoutes, {
        prefix: AUDIT_URL_PATH,
        feed: options.audit
      });
      await signedIn.register(gameRoutes, {
        prefix: GAME_URL_PATH,
        game: options.game
      });
      await signedIn.register(preferencesRoutes, {
        prefix: PREFERENCES_URL_PATH,
        preferences: new StoredPreferences(
          options.accounts,
          options.preferences
        )
      });
    });
    await app.ready();

    return new StudioApi(app);
  }

  readonly middleware: Middleware;

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
    } satisfies ApiFailure);
}
