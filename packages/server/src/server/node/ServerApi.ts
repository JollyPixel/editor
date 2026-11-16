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
import { accountsFailures } from "../../accounts/node/accountsFailures.ts";
import {
  accountsRoutes,
  serverAccountsRoutes
} from "../../accounts/node/routes.ts";
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
import { requestPathname } from "../../http/node/requestPathname.ts";
import type { RequestScoped } from "../../http/node/RequestScoped.ts";
import type { ProjectMount } from "../../projects/node/ProjectMount.ts";
import type { ProjectIndex } from "../../projects/node/ProjectIndex.ts";
import { projectsRoutes } from "../../projects/node/routes.ts";
import { PROJECTS_URL_PATH } from "../../projects/api.ts";
import type { ProjectLease } from "../../projects/node/OpenProjects.ts";
import { projectsFailures } from "../../projects/node/projectsFailures.ts";
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
import type { ProjectBackend } from "./ProjectBackend.ts";

// CONSTANTS
export const API_URL_PATH = "/api/";
const kMaxBodyBytes = 4 * 1_024;
const kDefaultRequestsPerMinute = 300;
const kDomainFailures: readonly DomainFailures[] = [
  projectsFailures,
  accountsFailures,
  projectFailures,
  gameFailures,
  preferencesFailures
];

declare module "fastify" {
  interface FastifyRequest {
    project: ProjectBackend | null;
  }
}

export type TrustProxy = boolean | string | string[];

export interface ProjectLeases {
  acquire(slug: string): Promise<ProjectLease<ProjectBackend>>;
}

export interface ServerApiOptions {
  accounts: Accounts;
  mount: ProjectMount;
  projects: ProjectLeases;
  /**
   * Lists and creates the projects at `/api/projects/`, with server-wide
   * sign-in at `/api/accounts/`. Without it, the root API is the project's.
   */
  index?: ProjectIndex;
  requestsPerMinute?: number;
  trustProxy?: TrustProxy;
}

export class ServerApi implements AsyncDisposable {
  static async open(
    options: ServerApiOptions
  ): Promise<ServerApi> {
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
    app.decorateRequest("project", null);
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
    if (options.index !== undefined) {
      await app.register(serverAccountsRoutes, {
        prefix: ACCOUNTS_URL_PATH,
        accounts: options.accounts
      });
      await app.register(projectsRoutes, {
        prefix: PROJECTS_URL_PATH,
        accounts: options.accounts,
        index: options.index
      });
    }
    await app.register(async(project) => {
      project.addHook("onRequest", async(request, reply) => {
        const location = options.mount.locate(
          requestPathname(request.raw)
        );
        if (location === null) {
          throw new ApiError(
            404,
            "not-found",
            "no project answers this request"
          );
        }
        const lease = await options.projects.acquire(location.slug);
        reply.raw.once("close", () => lease[Symbol.dispose]());
        request.project = lease.project;
      });
      await project.register(accountsRoutes, {
        prefix: ACCOUNTS_URL_PATH,
        accounts: options.accounts,
        realm: fromProject("realm")
      });
      await project.register(async(signedIn) => {
        signedIn.addHook(
          "preParsing",
          authenticate(fromProject("realm"))
        );

        await signedIn.register(sharesRoutes, {
          prefix: SHARES_URL_PATH,
          shares: fromProject("shares")
        });
        await signedIn.register(golemRoutes, {
          prefix: GOLEM_TOKENS_URL_PATH,
          realm: fromProject("realm")
        });
        await signedIn.register(projectRoutes, {
          prefix: PROJECT_URL_PATH,
          archive: fromProject("archive"),
          settings: fromProject("settings")
        });
        await signedIn.register(auditRoutes, {
          prefix: AUDIT_URL_PATH,
          feed: fromProject("audit")
        });
        await signedIn.register(gameRoutes, {
          prefix: GAME_URL_PATH,
          game: fromProject("game"),
          gameExport: fromProject("gameExport")
        });
        await signedIn.register(preferencesRoutes, {
          prefix: PREFERENCES_URL_PATH,
          preferences: fromProject("preferences")
        });
      });
    }, {
      prefix: options.mount.routePrefix
    });
    await app.ready();

    return new ServerApi(app);
  }

  #app: FastifyInstance;

  private constructor(
    app: FastifyInstance
  ) {
    this.#app = app;
  }

  route(
    request: IncomingMessage,
    response: ServerResponse
  ): void {
    this.#app.routing(request, response);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#app.close();
  }
}

function fromProject<TKey extends keyof ProjectBackend>(
  key: TKey
): RequestScoped<ProjectBackend[TKey]> {
  return (request) => {
    if (request.project === null) {
      throw new ApiError(404, "not-found", "no project answers this request");
    }

    return request.project[key];
  };
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
