// Import Internal Dependencies
import { BootTrace } from "./BootTrace.ts";
import type { EditorHandle } from "./EditorDefinition.ts";
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type { EditorLaunch } from "../launch/EditorLaunch.ts";
import type { LaunchHistory } from "../launch/LaunchHistory.ts";
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";
import type { EditorSession } from "../session/EditorSession.ts";
import type { EditorToolbarSources } from "../session/EditorToolbarSources.ts";

// CONSTANTS
const kSettleTimeoutMs = 10_000;

type HistoryEntry = "push" | "none";

export interface MountParts {
  readonly launch: EditorLaunch;
  readonly session: EditorSession;
  readonly toolbar: EditorToolbarSources;
}

export interface MountedEditor<
  THandle extends EditorHandle
> extends MountParts {
  readonly handle: THandle;
}

export interface MountSessions {
  open(
    launch: EditorLaunch
  ): Promise<EditorSession>;
}

export interface EditorMountOptions<THandle extends EditorHandle> {
  sessions: MountSessions;
  toolbar(
    launch: EditorLaunch,
    session: EditorSession,
    navigator: LaunchNavigator
  ): EditorToolbarSources;
  mount(
    parts: MountParts
  ): Promise<THandle>;
  history: LaunchHistory;
  logger: HostLogger;
  onMounted?(
    mounted: MountedEditor<THandle>
  ): void;
}

export class EditorMount<
  THandle extends EditorHandle
> implements LaunchNavigator {
  readonly #options: EditorMountOptions<THandle>;
  readonly #following = new AbortController();
  #mounted: MountedEditor<THandle> | null = null;
  #latestRequest = 0;
  #switching: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(
    options: EditorMountOptions<THandle>
  ) {
    this.#options = options;
  }

  get current(): MountedEditor<THandle> {
    if (this.#mounted === null) {
      throw new Error("The standalone editor is not mounted.");
    }

    return this.#mounted;
  }

  start(
    launch: EditorLaunch,
    boot: BootTrace
  ): Promise<void> {
    const started = this.#show(launch, boot, "none");
    this.#switching = started.catch(() => undefined);
    this.#options.history.follow((followed) => {
      this.#request(followed.target.value, followed.tag, "none")
        .catch(() => undefined);
    }, this.#following.signal);

    return started;
  }

  navigate(
    target: string,
    tag: string | null
  ): Promise<void> {
    return this.#request(target, tag, "push");
  }

  dispose(): void {
    this.#disposed = true;
    this.#latestRequest++;
    this.#following.abort();
    const mounted = this.#mounted;
    this.#mounted = null;
    if (mounted !== null) {
      mounted.toolbar.dispose();
      mounted.handle.dispose();
      mounted.session.dispose();
    }
  }

  #request(
    target: string,
    tag: string | null,
    entry: HistoryEntry
  ): Promise<void> {
    const request = ++this.#latestRequest;
    const switching = this.#switching.then(() => {
      const current = this.#mounted;
      if (request !== this.#latestRequest || current === null) {
        return undefined;
      }

      const trace = new BootTrace(
        this.#options.logger.child({ namespace: "host.switch" })
      );

      return this.#show(current.launch.retarget(target, tag), trace, entry);
    });
    this.#switching = switching.catch(() => undefined);

    return switching;
  }

  async #show(
    launch: EditorLaunch,
    trace: BootTrace,
    entry: HistoryEntry
  ): Promise<void> {
    const current = this.#mounted;
    if (current?.launch.sameView(launch)) {
      return;
    }

    const request = this.#latestRequest;
    if (current !== null) {
      trace.state("switching");
    }
    let session: EditorSession;
    try {
      if (current !== null) {
        await trace.step(
          "settle",
          () => current.session.assets.settled(
            AbortSignal.timeout(kSettleTimeoutMs)
          )
        );
      }
      session = await trace.step(
        "session",
        () => this.#options.sessions.open(launch)
      );
    }
    catch (error) {
      if (current !== null) {
        trace.fail(error);
        trace.state("ready");
      }

      throw error;
    }
    if (this.#disposed || this.#mounted !== current) {
      session.dispose();

      return;
    }

    if (current !== null) {
      current.toolbar.dispose();
      current.handle.dispose();
      this.#mounted = null;
    }
    try {
      this.#adopt(await this.#mountOn(trace, launch, session));
    }
    catch (error) {
      if (current !== null) {
        trace.fail(error);
        trace.state("failed");
        this.#options.history.reload(launch);
      }

      throw error;
    }
    finally {
      current?.session.dispose();
    }

    if (entry === "push" && request === this.#latestRequest) {
      this.#options.history.record(launch);
    }
    trace.state("ready");
  }

  #adopt(
    mounted: MountedEditor<THandle>
  ): void {
    this.#mounted = mounted;
    this.#options.onMounted?.(mounted);
  }

  async #mountOn(
    trace: BootTrace,
    launch: EditorLaunch,
    session: EditorSession
  ): Promise<MountedEditor<THandle>> {
    const toolbar = this.#options.toolbar(launch, session, this);
    let handle: THandle;
    try {
      handle = await trace.step("mount", () => this.#options.mount({
        launch,
        session,
        toolbar
      }));
    }
    catch (error) {
      toolbar.dispose();
      session.dispose();

      throw error;
    }

    try {
      await trace.step("ready", () => handle.ready);
    }
    catch (error) {
      toolbar.dispose();
      handle.dispose();
      session.dispose();

      throw error;
    }

    return {
      launch,
      session,
      toolbar,
      handle
    };
  }
}
