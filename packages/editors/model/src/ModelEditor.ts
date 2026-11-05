// Import Third-party Dependencies
import {
  MODEL_KIND,
  modelFileDocumentKind
} from "@jolly-pixel/asset.model/client";
import {
  EditorRuntime,
  Teardown,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import type { Runtime } from "@jolly-pixel/runtime";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { ModelFile } from "./file/ModelFile.ts";
import { AnimationPlayer } from "./player/AnimationPlayer.ts";
import { ModelPreview } from "./preview/ModelPreview.ts";
import { ModelViewerScene } from "./scene/ModelViewerScene.ts";

// CONSTANTS
const kCanvas = "#model-viewport canvas";
const kModelKind = modelFileDocumentKind();
const kPerformanceStorageKey = "model:performance-hud";

export interface ModelEditorParts {
  runtime: Runtime;
  session: EditorSession;
  player: AnimationPlayer;
  preview: ModelPreview;
  ready: Promise<void>;
  teardown: Teardown;
}

export class ModelEditor {
  static readonly accepts = MODEL_KIND;
  static readonly identity = {
    title: "Join model"
  };
  static readonly kinds = [kModelKind];
  static readonly archive = {
    fallbackName: "model",
    resetWarning: "Every model stored in this browser is deleted. " +
      "Export what you want to keep first."
  };

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    void Systems.BakedRoomEnvironment.load();

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
  ): Promise<ModelEditor> {
    const {
      session,
      runtime: editorRuntime
    } = context;
    const target = session.targetLease(kModelKind);
    const teardown = new Teardown();

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const layout = document.querySelector("jolly-dock-layout");
      const fileFolder = document.querySelector("jolly-model-file");
      const animate = document.querySelector("jolly-model-animate");
      const details = document.querySelector("jolly-model-details");
      const status = document.querySelector("jolly-model-status");
      if (
        layout === null ||
        fileFolder === null ||
        animate === null ||
        details === null ||
        status === null
      ) {
        throw new Error("ModelEditor: the page is missing a model pane.");
      }

      const { runtime } = editorRuntime;
      const player = new AnimationPlayer(() => runtime.world.invalidate());
      const file = new ModelFile(session, target.document);
      const preview = new ModelPreview(file);
      fileFolder.attach(file, context.notifications);
      animate.attach(player);
      details.attach(preview);
      status.attach(preview);

      const scene = new ModelViewerScene({
        preview,
        player,
        preferences: context.preferences
      });
      const { sceneManager } = runtime.world;
      teardown.defer(() => sceneManager.unloadScene(scene));
      await editorRuntime.load(scene);
      teardown.defer(editorRuntime.mountPerformancePane({
        target: layout,
        storageKey: kPerformanceStorageKey,
        logger: context.logger
      }));

      const ready = target.ready.then(() => {
        if (!teardown.signal.aborted) {
          teardown.defer(preview.follow());
        }
      });

      return new ModelEditor({
        runtime,
        session,
        player,
        preview,
        ready,
        teardown
      });
    }
    catch (error) {
      teardown.run();

      throw error;
    }
  }

  #teardown: Teardown;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly session: EditorSession;
  readonly player: AnimationPlayer;
  readonly preview: ModelPreview;

  constructor(
    parts: ModelEditorParts
  ) {
    this.runtime = parts.runtime;
    this.session = parts.session;
    this.player = parts.player;
    this.preview = parts.preview;
    this.ready = parts.ready;
    this.#teardown = parts.teardown;
  }

  dispose(): void {
    this.#teardown.run();
  }
}
