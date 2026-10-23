// Import Third-party Dependencies
import type { RegistrationHandle } from "@jolly-pixel/console";
import type { Runtime } from "@jolly-pixel/runtime";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import {
  PIXEL_ART_KIND,
  pixelArtDocumentKind,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/client";
import {
  VOXEL_MODEL_KIND,
  voxelModelDocumentKind,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";
import { voxelAnimationDocumentKind } from "@jolly-pixel/asset.voxel-animation/client";
import {
  EditorRuntime,
  PreferenceStorage,
  followKeyBindings,
  type AssetLease,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import {
  UvNetLibrary,
  pixelArtConsole
} from "@jolly-pixel/editor.pixel-art";
import {
  PIXEL_ART_KEYBINDINGS,
  PIXEL_ART_PREFERENCES
} from "@jolly-pixel/editor.pixel-art/preferences";
import { BakedRoomEnvironment } from "@jolly-pixel/three";

// Import Internal Dependencies
import {
  ModelEditorScene,
  type ModelEditing
} from "../scene/ModelEditorScene.ts";
import {
  PresenceStore,
  ViewSettingsStore
} from "../state/index.ts";
import { EditorShell } from "./EditorShell.ts";
import { sessionAnimationSets } from "./animationSetSource.ts";
import { VOXEL_MODEL_KEYBINDINGS } from "../preferences.ts";

// CONSTANTS
const kCanvas = "#three-renderer canvas";
const kModelKind = voxelModelDocumentKind();
const kTextureKind = pixelArtDocumentKind();
const kAnimationKind = voxelAnimationDocumentKind();
const kPerformanceStorageKey = "voxel-model:performance-hud";

export type ModelTextureLease = AssetLease<
  PixelDocument,
  PixelNetworkCommand,
  PixelServerMessage
>;

export interface VoxelModelEditorParts {
  runtime: Runtime;
  scene: ModelEditorScene;
  editing: ModelEditing;
  session: EditorSession;
  shell: EditorShell;
  target: AssetLease<ModelDocument>;
  consoleFeatures: RegistrationHandle;
  disposePerformancePane: () => void;
}

export class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = {
    title: "Join voxel model"
  };
  static readonly kinds = [kModelKind, kTextureKind];
  static readonly archive = {
    fallbackName: "model",
    resetWarning: "Every model and texture stored in this browser is " +
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
  ): Promise<VoxelModelEditor> {
    const {
      session,
      commands,
      runtime: editorRuntime
    } = context;
    const reference = session.catalog
      .dependencies.listDependencies(session.target.record.id)
      .find((dependency) => dependency.kind === PIXEL_ART_KIND);
    if (reference === undefined) {
      throw new Error("VoxelModelEditor: the model has no pixel-art texture.");
    }

    const texture = session.lease(kTextureKind, reference.id);
    const target = session.targetLease(kModelKind);
    await texture.ready;
    const roomEnvironment = await BakedRoomEnvironment.load()
      .catch((error: unknown) => {
        console.warn("[voxel-model] No environment map for the viewport.", error);

        return null;
      });

    const scene = new ModelEditorScene({
      room: target.room,
      document: target.document,
      presence: new PresenceStore(),
      pixels: texture.document,
      animationSets: sessionAnimationSets(session, kAnimationKind),
      view: new ViewSettingsStore(context.preferences),
      archives: context.archives,
      roomEnvironment,
      preferences: context.preferences,
      keyBindings: followKeyBindings(
        context.preferences,
        VOXEL_MODEL_KEYBINDINGS,
        (message) => console.warn(message)
      ),
      keyboardLayout: context.keyboardLayout
    });
    const keyBindingSettings = followKeyBindings(
      context.preferences,
      PIXEL_ART_KEYBINDINGS,
      (message) => console.warn(message)
    );
    const uvNets = new UvNetLibrary({
      storage: new PreferenceStorage(
        context.preferences,
        PIXEL_ART_PREFERENCES,
        "uvNets"
      )
    });
    const shell = new EditorShell({
      runtime: editorRuntime,
      texture,
      keyBindingSettings,
      uvNets,
      toolbar: context.toolbar
    });
    await editorRuntime.load(scene, {
      maxFps: Infinity
    });

    const editing = await context.logger.step(
      "scene",
      () => scene.ready
    );
    shell.adoptEditing(editing);

    const disposePerformancePane = editorRuntime.mountPerformancePane({
      target: shell.layout,
      storageKey: kPerformanceStorageKey,
      logger: context.logger
    });

    return new VoxelModelEditor({
      runtime: editorRuntime.runtime,
      scene,
      editing,
      session,
      shell,
      target,
      consoleFeatures: pixelArtConsole(commands, {
        keyBindingSettings,
        uvNets
      }),
      disposePerformancePane
    });
  }

  #shell: EditorShell;
  #consoleFeatures: RegistrationHandle;
  #disposePerformancePane: () => void;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly scene: ModelEditorScene;
  readonly editing: ModelEditing;
  readonly session: EditorSession;

  constructor(
    parts: VoxelModelEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.editing = parts.editing;
    this.session = parts.session;
    this.#shell = parts.shell;
    this.#consoleFeatures = parts.consoleFeatures;
    this.#disposePerformancePane = parts.disposePerformancePane;
    this.ready = Promise.all([
      parts.target.ready,
      parts.scene.ready
    ]).then(() => undefined);
  }

  dispose(): void {
    this.#disposePerformancePane();
    this.#consoleFeatures.unregister();
    this.#shell.dispose();
  }
}
