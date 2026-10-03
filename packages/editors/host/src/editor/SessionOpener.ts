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
import { EditorSession } from "../session/EditorSession.ts";
import type { CatalogOpener } from "../session/openCatalog.ts";
import type { StandaloneConnection } from "../workspace/SessionWorkspace.ts";

export interface SessionOpenerOptions {
  definition: EditorDefinition<EditorHandle>;
  connect?: () => StandaloneConnection | Promise<StandaloneConnection>;
  logger: HostLogger;
}

export class SessionOpener {
  readonly #definition: EditorDefinition<EditorHandle>;
  readonly #connect: SessionOpenerOptions["connect"];
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
    this.#queried = new QueryLaunchSource().peek();
    if (this.#queried !== undefined) {
      this.#early = this.#openSession(this.#queried, this.#launch.promise);
      this.#early.catch(() => undefined);
    }
  }

  open(
    launch: EditorLaunch
  ): Promise<EditorSession> {
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

    return this.#openSession(launch, Promise.resolve(launch));
  }

  dispose(): void {
    this.#launch.reject(new Error("The session opener was disposed."));
    void this.#early?.then((session) => session.dispose(), () => undefined);
    this.#early = null;
  }

  async #openSession(
    target: EditorLaunch,
    launch: Promise<EditorLaunch>
  ): Promise<EditorSession> {
    const definition = this.#definition;
    const options = {
      launch: target,
      kinds: definition.kinds,
      accepts: definition.accepts,
      logger: this.#logger
    };

    if (this.#connect === undefined) {
      return EditorSession.open({
        ...options,
        identity: definition.identity,
        openCatalog: shellCatalog(launch)
      });
    }

    const connection = await this.#connect();

    return EditorSession.connect({
      ...options,
      ...connection,
      openCatalog: connection.openCatalog ?? shellCatalog(launch)
    });
  }
}

function shellCatalog(
  launch: Promise<EditorLaunch>
): CatalogOpener {
  return async(client, options) => {
    const { shell } = await launch;

    return CatalogClient.connect(shell?.catalog ?? client, options);
  };
}
