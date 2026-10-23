// Import Third-party Dependencies
import type { RegistrationHandle } from "@jolly-pixel/console";

// Import Internal Dependencies
import { BootTrace } from "./BootTrace.ts";
import type {
  EditorContext,
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import { EditorMount } from "./EditorMount.ts";
import type {
  MountedEditor,
  MountRequest
} from "./MountedEditor.ts";
import type {
  MountStandaloneOptions,
  StandaloneMount
} from "./mountStandalone.ts";
import { Placement } from "./Placement.ts";
import { SessionOpener } from "./SessionOpener.ts";
import { archiveConsole } from "../console/namespaces/archive.ts";
import { peerConsole } from "../console/namespaces/peer.ts";
import { runtimeConsole } from "../console/namespaces/runtime.ts";
import type { HostLogger } from "../debug/readDebugLogger.ts";
import {
  EditorLaunch,
  HostMessageLaunchSource,
  InjectedLaunchSource,
  QueryLaunchSource
} from "../launch/index.ts";
import type { EditorRuntime } from "../runtime/EditorRuntime.ts";
import { EditorArchives } from "../session/EditorArchives.ts";
import { rememberQueryUsername } from "../session/rememberQueryUsername.ts";
import { PageState } from "./PageState.ts";

// CONSTANTS
export const DEBUG_HANDLE = "jollyEditor";

declare global {
  interface Window {
    jollyEditor?: EditorHandle;
  }
}

export type StandaloneMountOptions = Omit<MountStandaloneOptions, "logger">;

export class StandaloneEditor<
  THandle extends EditorHandle
> implements StandaloneMount<THandle> {
  static #registerConsoles(
    context: EditorContext,
    runtime: EditorRuntime | null,
    request: MountRequest
  ): void {
    const { commands, archives, session } = context;
    function own(
      handle: RegistrationHandle
    ): void {
      request.own(() => handle.unregister());
    }

    own(archiveConsole(commands, { archives }));
    own(peerConsole(commands, { peers: session.offline?.peers }));
    if (runtime !== null) {
      own(runtimeConsole(commands, { runtime }));
    }
  }

  readonly definition: EditorDefinition<THandle>;

  readonly #logger: HostLogger;
  readonly #leaving = new AbortController();
  readonly #page = new PageState();
  readonly #mountDefinition: (
    context: EditorContext
  ) => Promise<THandle>;
  #runtime: Promise<EditorRuntime> | null = null;
  #sessions: SessionOpener | null = null;
  #placement: Placement | null = null;
  #mount: EditorMount<THandle> | null = null;
  #debugHandles: readonly string[] = [];

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

  get handle(): THandle {
    if (this.#mount === null) {
      throw new Error("The standalone editor is not mounted.");
    }

    return this.#mount.current.handle;
  }

  async mount(
    options: StandaloneMountOptions
  ): Promise<StandaloneMount<THandle>> {
    const logger = this.#logger;
    const boot = new BootTrace(
      logger.child({ namespace: "host.boot" }),
      this.#page
    );

    boot.state("booting");
    if (options.dev === true) {
      rememberQueryUsername();
      this.#debugHandles = options.debugHandle === undefined ?
        [DEBUG_HANDLE] :
        [DEBUG_HANDLE, options.debugHandle];
    }
    const queried = new QueryLaunchSource().peek();
    const sessions = new SessionOpener({
      definition: this.definition,
      connect: options.connect,
      queried,
      logger: logger.child({ namespace: "host.session" })
    });
    let placement: Placement | null = null;
    let editorMount: EditorMount<THandle> | null = null;
    try {
      const launch = await boot.step(
        "launch",
        () => this.#readLaunch(options, boot, queried)
      );
      const placed = new Placement(launch, {
        page: this.#page,
        logger
      });
      placement = placed;
      editorMount = new EditorMount({
        sessions,
        mount: (request) => this.#mountOn(placed, request),
        history: placed.history,
        logger,
        onMounted: (mounted) => this.#adopt(placed, mounted)
      });
      await editorMount.start(launch, boot);
      placed.guardUnsaved(editorMount.current.session.assets);
      this.#sessions = sessions;
      this.#placement = placed;
      this.#mount = editorMount;
      this.#followPage();

      return this;
    }
    catch (error) {
      boot.fail(error);
      boot.state("failed");
      editorMount?.dispose();
      sessions.dispose();
      placement?.dispose();

      throw error;
    }
  }

  navigate(
    target: string,
    tag: string | null
  ): Promise<void> {
    return this.#mount?.navigate(target, tag) ?? Promise.resolve();
  }

  dispose(): void {
    this.#leaving.abort();
    this.#mount?.dispose();
    this.#mount = null;
    this.#sessions?.dispose();
    this.#sessions = null;
    this.#placement?.dispose();
    this.#placement = null;
    this.#page.dispose();

    const runtime = this.#runtime;
    this.#runtime = null;
    void runtime?.then((created) => created.dispose(), () => undefined);
  }

  async #mountOn(
    placement: Placement,
    request: MountRequest
  ): Promise<THandle> {
    const runtime = await this.#runtime;
    const { launch, session, navigator } = request;
    const context: EditorContext = {
      ...placement.context(request),
      launch,
      session,
      logger: this.#logger.child({ namespace: "editor" }),
      archives: new EditorArchives({
        ...this.definition.archive,
        session,
        accepts: this.definition.accepts,
        navigator
      })
    };
    runtime?.widgets.follow(context.preferences);
    StandaloneEditor.#registerConsoles(context, runtime, request);

    return this.#mountDefinition(context);
  }

  #adopt(
    placement: Placement,
    mounted: MountedEditor<THandle>
  ): void {
    placement.rememberOpened(mounted.session);
    for (const name of this.#debugHandles) {
      Object.assign(globalThis, {
        [name]: mounted.handle
      });
    }
  }

  #followPage(): void {
    window.addEventListener("pagehide", (event) => {
      if (event.persisted) {
        this.dispose();
      }
    }, { signal: this.#leaving.signal });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        location.reload();
      }
    });
  }

  async #readLaunch(
    options: StandaloneMountOptions,
    boot: BootTrace,
    queried: EditorLaunch | undefined
  ): Promise<EditorLaunch> {
    const launch = await EditorLaunch.read(
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

    return queried?.target.equals(launch.target) ?
      launch.viewing(queried.tag) :
      launch;
  }
}
