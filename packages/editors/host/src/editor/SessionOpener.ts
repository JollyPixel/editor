// Import Third-party Dependencies
import { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import type { HostLogger } from "../debug/readDebugLogger.ts";
import {
  QueryLaunchSource,
  type EditorLaunch
} from "../launch/index.ts";
import {
  EditorSession,
  type EditorSessionTarget
} from "../session/EditorSession.ts";
import type { CatalogOpener } from "../session/openCatalog.ts";
import type { StandaloneConnection } from "../workspace/SessionWorkspace.ts";

type SessionConnect = () =>
  | StandaloneConnection
  | Promise<StandaloneConnection>;

export interface SessionOpenerOptions {
  definition: EditorDefinition<EditorHandle>;
  connect?: SessionConnect;
  logger: HostLogger;
}

export class SessionOpener {
  readonly #definition: EditorDefinition<EditorHandle>;
  readonly #connect: SessionConnect | undefined;
  readonly #logger: HostLogger;
  readonly #queried: EditorLaunch | undefined;
  readonly #launch = Promise.withResolvers<EditorLaunch>();
  #early: Promise<EditorSession> | null = null;

  constructor(
    options: SessionOpenerOptions
  ) {
    this.#definition = options.definition;
    this.#connect = options.connect;
    this.#logger = options.logger;
    this.#launch.promise.catch(() => undefined);
    if (options.connect === undefined) {
      return;
    }

    this.#queried = new QueryLaunchSource().peek();
    if (this.#queried !== undefined) {
      this.#early = this.#connectSession(
        options.connect,
        this.#queried,
        this.#launch.promise
      );
      this.#early.catch(() => undefined);
    }
  }

  open(
    launch: EditorLaunch
  ): Promise<EditorSession> {
    if (this.#connect === undefined) {
      return EditorSession.open({
        ...this.#sessionTarget(launch),
        identity: this.#definition.identity,
        openCatalog: shellCatalog(launch)
      });
    }

    this.#launch.resolve(launch);
    const early = this.#early;
    if (
      early !== null &&
      this.#queried?.target.value === launch.target.value
    ) {
      this.#early = null;

      return early;
    }
    this.dispose();

    return this.#connectSession(this.#connect, launch, launch);
  }

  dispose(): void {
    this.#launch.reject(new Error("The session opener was disposed."));
    void this.#early?.then((session) => session.dispose(), () => undefined);
    this.#early = null;
  }

  async #connectSession(
    connect: SessionConnect,
    target: EditorLaunch,
    launch: EditorLaunch | Promise<EditorLaunch>
  ): Promise<EditorSession> {
    const connection = await connect();

    return EditorSession.connect({
      ...this.#sessionTarget(target),
      ...connection,
      openCatalog: connection.openCatalog ?? shellCatalog(launch)
    });
  }

  #sessionTarget(
    launch: EditorLaunch
  ): EditorSessionTarget {
    return {
      launch,
      kinds: this.#definition.kinds,
      accepts: this.#definition.accepts,
      logger: this.#logger
    };
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
