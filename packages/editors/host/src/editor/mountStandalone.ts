// Import Third-party Dependencies
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  EditorContext,
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import { forwardConsole } from "../console/forwardConsole.ts";
import {
  mountConsole,
  type PageConsole
} from "../console/mountConsole.ts";
import {
  readDebugLogger,
  type HostLogger
} from "../debug/readDebugLogger.ts";
import {
  EditorLaunch,
  HostMessageLaunchSource,
  InjectedLaunchSource,
  LastOpenedLaunchSource,
  QueryLaunchSource,
  type LaunchSource
} from "../launch/index.ts";
import {
  EditorSession,
  type EditorSessionClient
} from "../session/EditorSession.ts";
import { rememberQueryUsername } from "../session/rememberQueryUsername.ts";
import type { SessionWorkspace } from "../workspace/SessionWorkspace.ts";

// CONSTANTS
export const EDITOR_STATE_ATTRIBUTE = "data-editor-state";
export const DEBUG_HANDLE = "jollyEditor";

export type EditorState = "booting" | "ready" | "failed";

declare global {
  interface Window {
    jollyEditor?: EditorHandle;
  }
}

export interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
  workspace?: SessionWorkspace;
}

export interface MountStandaloneOptions {
  /**
   * Read when the parent answers no `jolly-launch`.
   * @default [new QueryLaunchSource(), new InjectedLaunchSource()]
   */
  sources?: Iterable<LaunchSource>;
  dev?: boolean;
  debugHandle?: string;
  /**
   * Replaces the username prompt and the WebSocket client, for a back-end
   * that is not the page's asset server.
   */
  connect?: () => StandaloneConnection | Promise<StandaloneConnection>;
  /**
   * Origins the parent's `jolly-launch` is accepted from.
   * @default [location.origin]
   */
  origins?: Iterable<string>;
  /**
   * @default readDebugLogger()
   */
  logger?: HostLogger;
}

export async function mountStandalone<
  THandle extends EditorHandle
>(
  definition: EditorDefinition<THandle>,
  options: MountStandaloneOptions = {}
): Promise<THandle> {
  const logger = options.logger ?? readDebugLogger();
  const boot = new BootTrace(
    logger.child({ namespace: "host.boot" })
  );

  boot.state("booting");
  let editorConsole: PageConsole | null = null;
  try {
    const launch = await boot.step("launch", () => EditorLaunch.read(
      [
        new HostMessageLaunchSource({
          origins: options.origins,
          logger: logger.child({ namespace: "host.launch" })
        }),
        ...options.sources ?? [
          new QueryLaunchSource(),
          new InjectedLaunchSource()
        ]
      ],
      boot.logger
    ));
    editorConsole = launch.shell === null ?
      mountConsole() :
      forwardConsole(launch.shell);

    const handle = await mountEditor(
      definition,
      options,
      logger,
      boot,
      {
        launch,
        commands: editorConsole.commands
      }
    );
    boot.state("ready");

    return handle;
  }
  catch (error) {
    editorConsole?.dispose();
    boot.fail(error);
    boot.state("failed");

    throw error;
  }
}

async function mountEditor<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options: MountStandaloneOptions,
  logger: HostLogger,
  boot: BootTrace,
  page: Pick<EditorContext, "launch" | "commands">
): Promise<THandle> {
  const { launch, commands } = page;
  const dev = options.dev === true;
  const target = {
    launch,
    kinds: definition.kinds,
    accepts: definition.accepts,
    logger: logger.child({ namespace: "host.session" })
  };

  if (dev) {
    rememberQueryUsername();
  }
  const { connect } = options;
  const session = await boot.step("session", async() => (
    connect === undefined ?
      EditorSession.open({
        ...target,
        identity: definition.identity
      }) :
      EditorSession.connect({
        ...target,
        ...await connect()
      })
  ));

  let handle: THandle;
  try {
    handle = await boot.step("mount", () => definition.mount({
      launch,
      session,
      shell: launch.shell,
      logger: logger.child({ namespace: "editor" }),
      commands
    }));
  }
  catch (error) {
    session.dispose();

    throw error;
  }

  try {
    await boot.step("ready", () => handle.ready);
  }
  catch (error) {
    handle.dispose();

    throw error;
  }

  if (session.workspace !== null) {
    LastOpenedLaunchSource.remember(
      definition.accepts,
      launch.target.value
    );
  }

  if (dev) {
    Object.assign(globalThis, {
      [DEBUG_HANDLE]: handle
    });
    if (options.debugHandle !== undefined) {
      Object.assign(globalThis, {
        [options.debugHandle]: handle
      });
    }
  }

  return handle;
}

class BootTrace {
  readonly logger: HostLogger;

  #step: string | null = null;

  constructor(
    logger: HostLogger
  ) {
    this.logger = logger;
  }

  async step<T>(
    name: string,
    run: () => Promise<T>
  ): Promise<T> {
    this.#step = name;
    const result = await this.logger.step(name, run);
    this.#step = null;

    return result;
  }

  state(
    state: EditorState
  ): void {
    document.documentElement.setAttribute(EDITOR_STATE_ATTRIBUTE, state);
    this.logger.debug(`state ${state}`);
  }

  fail(
    error: unknown
  ): void {
    if (this.#step === null) {
      this.logger.error("boot failed", {
        error
      });
    }
  }
}
