// Import Third-party Dependencies
import { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type { EditorLaunch } from "../launch/index.ts";
import type { EditorSession } from "../session/EditorSession.ts";
import type { CatalogOpener } from "../session/openCatalog.ts";
import { SessionConnection } from "../session/SessionConnection.ts";
import type { StandaloneConnection } from "../workspace/SessionWorkspace.ts";

type SessionConnect = () =>
  | StandaloneConnection
  | Promise<StandaloneConnection>;

export interface SessionOpenerOptions {
  definition: EditorDefinition<EditorHandle>;
  connect?: SessionConnect;
  /**
   * The launch of the page URL, which `connect` opens before the launch
   * sources settle.
   */
  queried?: EditorLaunch;
  logger: HostLogger;
}

export class SessionOpener {
  readonly #definition: EditorDefinition<EditorHandle>;
  readonly #connect: SessionConnect | undefined;
  readonly #logger: HostLogger;
  readonly #queried: EditorLaunch | undefined;
  readonly #launch = Promise.withResolvers<EditorLaunch>();
  #connection: Promise<SessionConnection> | null = null;
  #early: Promise<EditorSession> | null = null;
  #disposed = false;

  constructor(
    options: SessionOpenerOptions
  ) {
    this.#definition = options.definition;
    this.#connect = options.connect;
    this.#logger = options.logger;
    this.#queried = options.queried;
    this.#launch.promise.catch(() => undefined);
    if (options.connect === undefined || this.#queried === undefined) {
      return;
    }

    this.#connection = this.#connectWith(
      options.connect,
      this.#launch.promise
    );
    this.#connection.catch(() => undefined);
    this.#early = this.#openOn(this.#connection, this.#queried);
    this.#early.catch(() => undefined);
  }

  open(
    launch: EditorLaunch
  ): Promise<EditorSession> {
    if (this.#disposed) {
      return Promise.reject(new Error("The session opener was disposed."));
    }
    this.#launch.resolve(launch);
    const early = this.#early;
    this.#early = null;
    if (early !== null && this.#queried?.sameView(launch) === true) {
      return early;
    }
    void early?.then((session) => session.dispose(), () => undefined);

    this.#connection ??= this.#connectFor(launch);

    return this.#openOn(this.#connection, launch);
  }

  dispose(): void {
    this.#disposed = true;
    this.#launch.reject(new Error("The session opener was disposed."));
    this.#early = null;
    void this.#connection?.then(
      (connection) => connection.dispose(),
      () => undefined
    );
    this.#connection = null;
  }

  async #openOn(
    connection: Promise<SessionConnection>,
    launch: EditorLaunch
  ): Promise<EditorSession> {
    return (await connection).openSession({
      launch,
      kinds: this.#definition.kinds,
      accepts: this.#definition.accepts,
      logger: this.#logger
    });
  }

  #connectFor(
    launch: EditorLaunch
  ): Promise<SessionConnection> {
    if (this.#connect === undefined) {
      return SessionConnection.open({
        identity: this.#definition.identity,
        shell: launch.shell,
        logger: this.#logger,
        openCatalog: shellCatalog(launch)
      });
    }

    return this.#connectWith(this.#connect, launch);
  }

  async #connectWith(
    connect: SessionConnect,
    launch: EditorLaunch | Promise<EditorLaunch>
  ): Promise<SessionConnection> {
    const connection = await connect();

    return SessionConnection.connect({
      ...connection,
      logger: this.#logger,
      openCatalog: connection.openCatalog ?? shellCatalog(launch)
    });
  }
}

function shellCatalog(
  launch: EditorLaunch | Promise<EditorLaunch>
): CatalogOpener {
  return async(client, options) => {
    const { shell } = await launch;

    return CatalogClient.connect(shell?.catalog ?? client, options);
  };
}
