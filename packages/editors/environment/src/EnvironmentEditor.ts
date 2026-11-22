// Import Third-party Dependencies
import {
  ENVIRONMENT_KIND,
  environmentDocumentKind
} from "@jolly-pixel/asset.environment/client";
import {
  EditorRuntime,
  followKeyBindings,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import { type Runtime, BakedRoomEnvironment } from "@jolly-pixel/backend.three";
import { Teardown } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { EnvironmentEdits } from "./editing/EnvironmentEdits.ts";
import {
  createEnvironmentHistory,
  type EnvironmentHistory
} from "./editing/environmentHistory.ts";
import { ENVIRONMENT_KEYBINDINGS } from "./preferences.ts";
import { EnvironmentPreviewScene } from "./scene/EnvironmentPreviewScene.ts";

// CONSTANTS
const kCanvas = "#environment-viewport canvas";
const kEnvironmentKind = environmentDocumentKind();
const kPerformanceStorageKey = "environment:performance-hud";

export interface EnvironmentEditorParts {
  runtime: Runtime;
  session: EditorSession;
  edits: EnvironmentEdits;
  history: EnvironmentHistory;
  ready: Promise<void>;
  teardown: Teardown;
}

export class EnvironmentEditor {
  static readonly accepts = ENVIRONMENT_KIND;
  static readonly identity = {
    title: "Join environment"
  };
  static readonly kinds = [kEnvironmentKind];
  static readonly archive = {
    fallbackName: "environment",
    resetWarning: "Every environment stored in this browser is deleted. " +
      "Export what you want to keep first."
  };

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    void BakedRoomEnvironment.load();

    return EditorRuntime.create(kCanvas, {
      includePerformanceStats: {
        position: "top-right"
      },
      focusCanvas: false,
      viewHelper: true,
      logger
    });
  }

  static async mount(
    context: RuntimeEditorContext
  ): Promise<EnvironmentEditor> {
    const {
      session,
      runtime: editorRuntime
    } = context;
    const target = session.targetLease(kEnvironmentKind);
    const teardown = new Teardown();

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const layout = document.querySelector("jolly-dock-layout");
      const panel = document.querySelector("jolly-environment-panel");
      if (layout === null || panel === null) {
        throw new Error("EnvironmentEditor: the page is missing its panel.");
      }

      const edits = new EnvironmentEdits(target.document);
      teardown.defer(() => edits.dispose());
      const history = createEnvironmentHistory(target.document);
      teardown.defer(() => history.dispose());
      panel.attach(edits);

      const scene = new EnvironmentPreviewScene({
        edits,
        history,
        keyBindings: followKeyBindings(
          context.preferences,
          ENVIRONMENT_KEYBINDINGS,
          (message) => console.warn(message)
        ),
        preferences: context.preferences
      });
      const { runtime } = editorRuntime;
      const { sceneManager } = runtime.world;
      teardown.defer(() => sceneManager.unloadScene(scene));
      await editorRuntime.load(scene);
      teardown.defer(editorRuntime.mountPerformancePane({
        target: layout,
        storageKey: kPerformanceStorageKey,
        logger: context.logger
      }));

      return new EnvironmentEditor({
        runtime,
        session,
        edits,
        history,
        ready: target.ready,
        teardown
      });
    }
    catch (error) {
      throw teardown.unwind(error);
    }
  }

  #teardown: Teardown;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly session: EditorSession;
  readonly edits: EnvironmentEdits;
  readonly history: EnvironmentHistory;

  constructor(
    parts: EnvironmentEditorParts
  ) {
    this.runtime = parts.runtime;
    this.session = parts.session;
    this.edits = parts.edits;
    this.history = parts.history;
    this.ready = parts.ready;
    this.#teardown = parts.teardown;
  }

  dispose(): void {
    this.#teardown.run();
  }
}
