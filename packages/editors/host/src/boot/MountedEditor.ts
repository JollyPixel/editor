// Import Internal Dependencies
import type { BootTrace } from "./BootTrace.ts";
import type { EditorHandle } from "./EditorDefinition.ts";
import { Teardown } from "./Teardown.ts";
import type { EditorLaunch } from "../launch/EditorLaunch.ts";
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";
import type { EditorSession } from "../session/EditorSession.ts";

export interface MountRequest {
  readonly launch: EditorLaunch;
  readonly session: EditorSession;
  readonly navigator: LaunchNavigator;

  own(
    release: () => void
  ): void;
}

export interface MountedEditorOptions<THandle extends EditorHandle> {
  launch: EditorLaunch;
  session: EditorSession;
  navigator: LaunchNavigator;
  trace: BootTrace;
  mount(
    request: MountRequest
  ): Promise<THandle>;
}

interface MountedEditorParts<THandle extends EditorHandle> {
  launch: EditorLaunch;
  session: EditorSession;
  handle: THandle;
  teardown: Teardown;
}

export class MountedEditor<THandle extends EditorHandle> {
  static async open<THandle extends EditorHandle>(
    options: MountedEditorOptions<THandle>
  ): Promise<MountedEditor<THandle>> {
    const { launch, session, navigator, trace } = options;
    const teardown = new Teardown();
    let handle: THandle;
    try {
      handle = await trace.step("mount", () => options.mount({
        launch,
        session,
        navigator,
        own: (release) => teardown.defer(release)
      }));
      const { ready, runtime } = handle;
      teardown.defer(() => handle.dispose());
      await trace.step("ready", () => ready);
      if (runtime !== null && document.visibilityState === "visible") {
        await trace.step("compile", () => runtime.compiledFrame());
      }
    }
    catch (error) {
      teardown.run();
      session.dispose();

      throw error;
    }

    return new MountedEditor({
      launch,
      session,
      handle,
      teardown
    });
  }

  readonly launch: EditorLaunch;
  readonly session: EditorSession;
  readonly handle: THandle;

  readonly #teardown: Teardown;

  constructor(
    parts: MountedEditorParts<THandle>
  ) {
    this.launch = parts.launch;
    this.session = parts.session;
    this.handle = parts.handle;
    this.#teardown = parts.teardown;
  }

  unmount(): void {
    this.#teardown.run();
  }

  dispose(): void {
    this.unmount();
    this.session.dispose();
  }
}
