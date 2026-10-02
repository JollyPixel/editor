// Import Internal Dependencies
import { BootTrace } from "./BootTrace.ts";
import type {
  EditorContext,
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import type { MountStandaloneOptions } from "./mountStandalone.ts";
import { SessionOpener } from "./SessionOpener.ts";
import { forwardConsole } from "../console/forwardConsole.ts";
import {
  mountConsole,
  type PageConsole
} from "../console/mountConsole.ts";
import type { HostLogger } from "../debug/readDebugLogger.ts";
import {
  EditorLaunch,
  HostMessageLaunchSource,
  InjectedLaunchSource,
  LastOpenedLaunchSource,
  QueryLaunchSource
} from "../launch/index.ts";
import type { EditorRuntime } from "../runtime/EditorRuntime.ts";
import { rememberQueryUsername } from "../session/rememberQueryUsername.ts";

// CONSTANTS
export const DEBUG_HANDLE = "jollyEditor";

declare global {
  interface Window {
    jollyEditor?: EditorHandle;
  }
}

export type StandaloneMountOptions = Omit<MountStandaloneOptions, "logger">;

export class StandaloneEditor<THandle extends EditorHandle> {
  readonly definition: EditorDefinition<THandle>;

  readonly #logger: HostLogger;
  readonly #mountDefinition: (context: EditorContext) => Promise<THandle>;
  #runtime: Promise<EditorRuntime> | null = null;

  constructor(
    definition: EditorDefinition<THandle>,
    logger: HostLogger
  ) {
    this.definition = definition;
    this.#logger = logger;

    if (definition.createRuntime === undefined) {
      this.#mountDefinition = (context) => definition.mount(context);

      return;
    }

    const runtime = (async() => definition.createRuntime(
      logger.child({ namespace: "editor.runtime" })
    ))();
    runtime.catch(() => undefined);
    this.#runtime = runtime;
    this.#mountDefinition = async(context) => definition.mount({
      ...context,
      runtime: await runtime
    });
  }

  async mount(
    options: StandaloneMountOptions
  ): Promise<THandle> {
    const logger = this.#logger;
    const boot = new BootTrace(
      logger.child({ namespace: "host.boot" })
    );

    boot.state("booting");
    if (options.dev === true) {
      rememberQueryUsername();
    }
    const sessions = new SessionOpener({
      definition: this.definition,
      connect: options.connect,
      logger: logger.child({ namespace: "host.session" })
    });
    let editorConsole: PageConsole | null = null;
    try {
      const launch = await boot.step(
        "launch",
        () => this.#readLaunch(options, boot)
      );
      editorConsole = launch.shell === null ?
        mountConsole() :
        forwardConsole(launch.shell);
      const session = await boot.step(
        "session",
        () => sessions.open(launch)
      );

      const handle = await this.#mountSession(boot, {
        launch,
        session,
        shell: launch.shell,
        logger: logger.child({ namespace: "editor" }),
        commands: editorConsole.commands
      });
      if (session.workspace !== null) {
        LastOpenedLaunchSource.remember(
          this.definition.accepts,
          launch.target.value
        );
      }
      if (options.dev === true) {
        exposeDebugHandle(handle, options.debugHandle);
      }
      boot.state("ready");

      return handle;
    }
    catch (error) {
      sessions.dispose();
      editorConsole?.dispose();
      boot.fail(error);
      boot.state("failed");

      throw error;
    }
  }

  dispose(): void {
    const runtime = this.#runtime;
    this.#runtime = null;
    void runtime?.then((created) => created.dispose(), () => undefined);
  }

  #readLaunch(
    options: StandaloneMountOptions,
    boot: BootTrace
  ): Promise<EditorLaunch> {
    return EditorLaunch.read(
      [
        new HostMessageLaunchSource({
          origins: options.origins,
          logger: this.#logger.child({ namespace: "host.launch" })
        }),
        ...options.sources ?? [
          new QueryLaunchSource(),
          new InjectedLaunchSource()
        ]
      ],
      boot.logger
    );
  }

  async #mountSession(
    boot: BootTrace,
    context: EditorContext
  ): Promise<THandle> {
    let handle: THandle;
    try {
      handle = await boot.step("mount", () => this.#mountDefinition(context));
    }
    catch (error) {
      context.session.dispose();

      throw error;
    }
    this.#runtime = null;

    try {
      await boot.step("ready", () => handle.ready);
    }
    catch (error) {
      handle.dispose();

      throw error;
    }

    return handle;
  }
}

function exposeDebugHandle(
  handle: EditorHandle,
  debugHandle: string | undefined
): void {
  Object.assign(globalThis, {
    [DEBUG_HANDLE]: handle
  });
  if (debugHandle !== undefined) {
    Object.assign(globalThis, {
      [debugHandle]: handle
    });
  }
}
