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
  #early: Promise<EditorSession> | null = null;

  constructor(
    options: SessionOpenerOptions
  ) {
    this.#definition = options.definition;
    this.#connect = options.connect;
    this.#logger = options.logger;
    this.#queried = new QueryLaunchSource().peek();
    if (this.#queried !== undefined) {
      this.#early = this.#openSession(this.#queried);
      this.#early.catch(() => undefined);
    }
  }

  open(
    launch: EditorLaunch
  ): Promise<EditorSession> {
    const early = this.#early;
    if (
      early !== null &&
      this.#queried?.target.value === launch.target.value
    ) {
      this.#early = null;

      return early;
    }
    this.dispose();

    return this.#openSession(launch);
  }

  dispose(): void {
    void this.#early?.then((session) => session.dispose(), () => undefined);
    this.#early = null;
  }

  async #openSession(
    launch: EditorLaunch
  ): Promise<EditorSession> {
    const definition = this.#definition;
    const target = {
      launch,
      kinds: definition.kinds,
      accepts: definition.accepts,
      logger: this.#logger
    };

    return this.#connect === undefined ?
      EditorSession.open({
        ...target,
        identity: definition.identity
      }) :
      EditorSession.connect({
        ...target,
        ...await this.#connect()
      });
  }
}
