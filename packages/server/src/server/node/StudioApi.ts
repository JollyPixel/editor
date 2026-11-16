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
  type Accounts,
  type AccountsRealm
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { accountsFailures } from "../../accounts/node/accountsFailures.ts";
import { accountsRoutes } from "../../accounts/node/routes.ts";
import { auditRoutes } from "../../audit/node/routes.ts";
import {
  gameFailures,
  gameRoutes
} from "../../game/node/routes.ts";
import { golemRoutes } from "../../golem/node/routes.ts";
import { authenticate } from "../../http/node/authentication.ts";
import { ApiError } from "../../http/node/errors/ApiError.ts";
import {
  apiFailure,
  type DomainFailures
} from "../../http/node/apiFailure.ts";
import type { Middleware } from "../../http/node/Middleware.ts";
import {
  preferencesFailures,
  preferencesRoutes
} from "../../preferences/node/routes.ts";
import {
  projectFailures,
  projectRoutes
} from "../../project/node/routes.ts";
import { sharesRoutes } from "../../shares/node/routes.ts";
import type { ApiFailure } from "../../http/api.ts";
import { PREFERENCES_URL_PATH } from "../../preferences/api.ts";
import { AUDIT_URL_PATH } from "../../audit/api.ts";
import { GAME_URL_PATH } from "../../game/api.ts";
import { GOLEM_TOKENS_URL_PATH } from "../../golem/api.ts";
import { PROJECT_URL_PATH } from "../../project/api.ts";
import { SHARES_URL_PATH } from "../../shares/api.ts";
import type { AuditFeed } from "../../audit/node/AuditFeed.ts";
import type { GameExport } from "../../game/node/GameExport.ts";
import type { StudioGame } from "../../game/node/StudioGame.ts";
import type { StoredPreferences } from "../../preferences/node/StoredPreferences.ts";
import type { ProjectArchive } from "../../project/node/ProjectArchive.ts";
import type { ProjectSettings } from "../../project/node/ProjectSettings.ts";
import type { StudioShares } from "../../shares/node/StudioShares.ts";

// CONSTANTS
export const API_URL_PATH = "/api/";
const kMaxBodyBytes = 4 * 1_024;
const kDefaultRequestsPerMinute = 300;
const kDomainFailures: readonly DomainFailures[] = [
  accountsFailures,
  projectFailures,
  gameFailures,
  preferencesFailures
];

export type TrustProxy = boolean | string | string[];

export interface StudioApiOptions {
  accounts: Accounts;
  realm: AccountsRealm;
  shares: StudioShares;
  archive: ProjectArchive;
  gameExport: GameExport;
  settings: ProjectSettings;
  audit: AuditFeed;
  game: StudioGame;
  preferences: StoredPreferences;
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
      const failure = apiFailure(error, kDomainFailures);
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
      accounts: options.accounts,
      realm: options.realm
    });
    await app.register(async(signedIn) => {
      signedIn.addHook("preParsing", authenticate(options.realm));

      await signedIn.register(sharesRoutes, {
        prefix: SHARES_URL_PATH,
        shares: options.shares
      });
      await signedIn.register(golemRoutes, {
        prefix: GOLEM_TOKENS_URL_PATH,
        realm: options.realm
      });
      await signedIn.register(projectRoutes, {
        prefix: PROJECT_URL_PATH,
        archive: options.archive,
        settings: options.settings
      });
      await signedIn.register(auditRoutes, {
        prefix: AUDIT_URL_PATH,
        feed: options.audit
      });
      await signedIn.register(gameRoutes, {
        prefix: GAME_URL_PATH,
        game: options.game,
        gameExport: options.gameExport
      });
      await signedIn.register(preferencesRoutes, {
        prefix: PREFERENCES_URL_PATH,
        preferences: options.preferences
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
