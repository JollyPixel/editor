// Import Third-party Dependencies
import {
  SCENE_KIND,
  sceneDocumentKind,
  type SceneDocument
} from "@jolly-pixel/asset.scene/client";
import {
  EditorRuntime,
  followKeyBindings,
  Teardown,
  type AssetLease,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import type { Runtime } from "@jolly-pixel/runtime";
import { BakedRoomEnvironment } from "@jolly-pixel/three";

// Import Internal Dependencies
import type { SceneEditing } from "../editing/SceneEditing.ts";
import { SessionAssetSlots } from "../editing/SessionAssetSlots.ts";
import { SCENE_KEYBINDINGS } from "../preferences.ts";
import { SceneEditorScene } from "../scene/SceneEditorScene.ts";
import { PresenceStore } from "../state/PresenceStore.ts";
import { EditorShell } from "./EditorShell.ts";
import { PROJECT_COMPONENTS } from "./projectComponents.ts";

// CONSTANTS
const kCanvas = "#scene-viewport canvas";
const kSceneKind = sceneDocumentKind();
const kPerformanceStorageKey = "scene:performance-hud";

export interface SceneEditorParts {
  runtime: Runtime;
  scene: SceneEditorScene;
  editing: SceneEditing;
  session: EditorSession;
  target: AssetLease<SceneDocument>;
  teardown: Teardown;
}

export class SceneEditor {
  static readonly accepts = SCENE_KIND;
  static readonly identity = {
    title: "Join scene"
  };
  static readonly kinds = [kSceneKind, ...PROJECT_COMPONENTS.documentKinds];
  static readonly archive = {
    fallbackName: "scene",
    resetWarning: "Every scene and asset stored in this browser is " +
      "deleted. Export what you want to keep first."
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
      renderer: {
        output: {
          shadows: {}
        }
      },
      logger
    });
  }

  static async mount(
    context: RuntimeEditorContext
  ): Promise<SceneEditor> {
    const {
      session,
      runtime: editorRuntime
    } = context;
    const target = session.targetLease(kSceneKind);
    const teardown = new Teardown();

    try {
      const shell = new EditorShell({ toolbar: context.toolbar });
      teardown.defer(() => shell.dispose());

      const assetSlots = new SessionAssetSlots({
        session,
        descriptors: PROJECT_COMPONENTS.descriptors,
        open: context.shell === null ?
          null :
          (assetId) => context.shell?.openAsset(assetId)
      });
      const scene = new SceneEditorScene({
        document: target.document,
        room: target.room,
        session,
        components: PROJECT_COMPONENTS,
        assetSlots,
        presence: new PresenceStore(),
        preferences: context.preferences,
        keyBindings: followKeyBindings(
          context.preferences,
          SCENE_KEYBINDINGS,
          (message) => console.warn(message)
        ),
        keyboardLayout: context.keyboardLayout
      });
      const { sceneManager } = editorRuntime.runtime.world;
      teardown.defer(() => sceneManager.unloadScene(scene));
      await editorRuntime.load(scene);

      const editing = await context.logger.step("scene", () => scene.ready);
      shell.adoptEditing(editing);
      const layout = document.querySelector("jolly-dock-layout");
      if (layout !== null) {
        teardown.defer(editorRuntime.mountPerformancePane({
          target: layout,
          storageKey: kPerformanceStorageKey,
          logger: context.logger
        }));
      }

      return new SceneEditor({
        runtime: editorRuntime.runtime,
        scene,
        editing,
        session,
        target,
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
  readonly scene: SceneEditorScene;
  readonly editing: SceneEditing;
  readonly session: EditorSession;

  constructor(
    parts: SceneEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.editing = parts.editing;
    this.session = parts.session;
    this.#teardown = parts.teardown;
    this.ready = parts.target.ready;
  }

  dispose(): void {
    this.#teardown.run();
  }
}
