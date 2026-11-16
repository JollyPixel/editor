// Import Node.js Dependencies
import type {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse
} from "node:http";
import type { Http2SecureServer } from "node:http2";
import type { Duplex } from "node:stream";

// Import Third-party Dependencies
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  openServerAccounts,
  type ServerAccountsOptions
} from "../../accounts/node/openServerAccounts.ts";
import type { Middleware } from "../../http/node/Middleware.ts";
import { requestPathname } from "../../http/node/requestPathname.ts";
import type { Project } from "../../project/node/Project.ts";
import { UnknownProjectError } from "../../projects/node/errors/UnknownProjectError.ts";
import { ProjectUnavailableError } from "../../projects/node/errors/ProjectUnavailableError.ts";
import { OpenProjects } from "../../projects/node/OpenProjects.ts";
import type { ProjectHosting } from "../../projects/node/ProjectHosting.ts";
import { ProjectIds } from "../../projects/node/ProjectIds.ts";
import { ProjectIndex } from "../../projects/node/ProjectIndex.ts";
import type {
  ProjectLocation,
  ProjectMount
} from "../../projects/node/ProjectMount.ts";
import {
  ProjectBackend,
  type ProjectBackendOptions
} from "./ProjectBackend.ts";
import {
  API_URL_PATH,
  ServerApi,
  type TrustProxy
} from "./ServerApi.ts";

// CONSTANTS
const kNotFoundUpgrade = [
  "HTTP/1.1 404 Not Found",
  "Connection: close",
  "Content-Length: 0",
  "",
  ""
].join("\r\n");

export interface ServerBackendOptions extends Omit<
  ProjectBackendOptions, "accounts"
> {
  hosting: ProjectHosting;
  /**
   * Opens the project found at a root of the hosting's registry.
   */
  openProject: (root: string) => Promise<Project>;
  accounts?: Omit<ServerAccountsOptions, "inMemory">;
  /**
   * @default 300
   */
  requestsPerMinute?: number;
  /**
   * Proxies whose `X-Forwarded-For` and `X-Forwarded-Proto` the API believes:
   * `true` for any, or addresses and CIDR ranges.
   * @default false
   */
  trustProxy?: TrustProxy;
  /**
   * Milliseconds a project stays open with no socket and no request, or
   * `null` to keep it open. In memory, projects stay open.
   * @default DEFAULT_PROJECT_IDLE_MS
   */
  idleMs?: number | null;
}

export class ServerBackend implements AsyncDisposable {
  static async open(
    options: ServerBackendOptions
  ): Promise<ServerBackend> {
    const {
      hosting,
      openProject,
      accounts: accountsOptions,
      requestsPerMinute,
      trustProxy,
      idleMs,
      ...projectOptions
    } = options;
    await using opening = new AsyncDisposableStack();
    const accounts = opening.use(await openServerAccounts(hosting.state, {
      ...accountsOptions,
      inMemory: options.inMemory
    }));
    const ids = new ProjectIds(hosting.registry);
    const projects = opening.use(new OpenProjects<ProjectBackend>({
      idleMs: options.inMemory === true ? null : idleMs,
      open: async(slug) => {
        const root = await hosting.registry.resolve(slug);
        if (root === null) {
          throw new UnknownProjectError(slug);
        }
        try {
          const project = await openProject(root);
          await ids.claim(project.id, slug);

          return await ProjectBackend.open(project, {
            ...projectOptions,
            accounts
          });
        }
        catch (error) {
          throw new ProjectUnavailableError(slug, error);
        }
      }
    }));
    const api = opening.use(await ServerApi.open({
      accounts,
      mount: hosting.mount,
      projects,
      index: hosting.mount.home === null ?
        undefined :
        new ProjectIndex({
          registry: hosting.registry,
          memberships: (accountId) => accounts.memberships(accountId),
          open: openProject
        }),
      requestsPerMinute,
      trustProxy
    }));

    return new ServerBackend(
      opening.move(),
      hosting.mount,
      projects,
      api
    );
  }

  readonly middleware: Middleware;

  #resources: AsyncDisposableStack;
  #mount: ProjectMount;
  #projects: OpenProjects<ProjectBackend>;
  #listeners = new DisposableStack();

  private constructor(
    resources: AsyncDisposableStack,
    mount: ProjectMount,
    projects: OpenProjects<ProjectBackend>,
    api: ServerApi
  ) {
    this.#resources = resources;
    this.#mount = mount;
    this.#projects = projects;
    this.middleware = (request, response, next) => {
      const pathname = requestPathname(request);
      const location = mount.locate(pathname);
      if (location === null) {
        if (pathname === "/" && mount.home !== null) {
          redirect(response, mount.home);
        }
        else if (pathname.startsWith(API_URL_PATH)) {
          api.route(request, response);
        }
        else {
          next();
        }
      }
      else if (location.pathname === "") {
        redirectToFolder(request, response, pathname);
      }
      else if (location.pathname.startsWith(API_URL_PATH)) {
        api.route(request, response);
      }
      else {
        this.#serveProject(location, request, response, next);
      }
    };
  }

  attach(
    httpServer: HttpServer | Http2SecureServer
  ): void {
    const upgrade = (
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer
    ): void => {
      const location = this.#mount.locate(requestPathname(request));
      if (location?.pathname === DEFAULT_WEBSOCKET_PATH) {
        this.#upgrade(location.slug, request, socket, head);
      }
    };
    httpServer.on("upgrade", upgrade);
    this.#listeners.defer(() => httpServer.off("upgrade", upgrade));
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.#listeners.dispose();
    await this.#resources.disposeAsync();
  }

  #serveProject(
    location: ProjectLocation,
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ): void {
    this.#projects.acquire(location.slug).then(
      (lease) => {
        response.once("close", () => lease[Symbol.dispose]());
        request.url = location.pathname + requestSearch(request);
        lease.project.middleware(request, response, next);
      },
      (error: unknown) => sendOpenFailure(response, error)
    );
  }

  #upgrade(
    slug: string,
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): void {
    socket.on("error", () => socket.destroy());
    this.#projects.acquire(slug).then(
      (lease) => {
        if (socket.destroyed) {
          lease[Symbol.dispose]();

          return;
        }
        socket.once("close", () => lease[Symbol.dispose]());
        lease.project.handleUpgrade(request, socket, head);
      },
      () => socket.end(kNotFoundUpgrade)
    );
  }
}

function requestSearch(
  request: IncomingMessage
): string {
  const url = request.url ?? "";
  const index = url.indexOf("?");

  return index === -1 ? "" : url.slice(index);
}

function redirectToFolder(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): void {
  response.statusCode = 308;
  response.setHeader("location", `${pathname}/${requestSearch(request)}`);
  response.end();
}

function redirect(
  response: ServerResponse,
  location: string
): void {
  response.statusCode = 302;
  response.setHeader("location", location);
  response.end();
}

function sendOpenFailure(
  response: ServerResponse,
  error: unknown
): void {
  if (error instanceof UnknownProjectError) {
    response.statusCode = 404;
  }
  else if (error instanceof ProjectUnavailableError) {
    response.statusCode = 503;
  }
  else {
    response.statusCode = 500;
    console.error(error);
  }
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(error instanceof Error ? error.message : "server error");
}
