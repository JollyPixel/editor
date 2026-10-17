// Import Third-party Dependencies
import {
  registerConsoleFeatures,
  type RegistrationHandle
} from "@jolly-pixel/console";
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
  archiveConsole,
  runtimeConsole,
  type AssetLease,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import {
  KeyBindingSettings,
  pixelArtConsole
} from "@jolly-pixel/editor.pixel-art";
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import { BakedRoomEnvironment } from "@jolly-pixel/three";

// Import Internal Dependencies
import {
  ModelEditorScene,
  type ModelWorkspace
} from "../scene/ModelEditorScene.ts";
import {
  PresenceStore,
  ViewSettingsStore
} from "../state/index.ts";
import { EditorShell } from "./EditorShell.ts";
import { sessionAnimationSets } from "./animationSetSource.ts";

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
  workspace: ModelWorkspace;
  session: EditorSession;
  shell: EditorShell;
  texture: ModelTextureLease;
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

    const texture = session.assets.open(
      kTextureKind,
      reference.id
    );
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
      view: new ViewSettingsStore({
        storage: new LocalStorageAdapter()
      }),
      archives: session.archives({
        fallbackName: "model",
        resetWarning: "Every model and texture stored in this browser is " +
          "deleted. Export what you want to keep first."
      }),
      roomEnvironment
    });
    const keyBindingSettings = new KeyBindingSettings({
      storage: new LocalStorageAdapter(),
      onDropped: (message) => console.warn(message)
    });
    const shell = new EditorShell({
      runtime: editorRuntime,
      texture,
      keyBindingSettings,
      toolbar: context.toolbar
    });
    await editorRuntime.load(scene, {
      maxFps: Infinity
    });

    const workspace = await context.logger.step(
      "scene",
      () => scene.ready
    );
    shell.adoptWorkspace(workspace);

    const disposePerformancePane = editorRuntime.mountPerformancePane({
      target: shell.layout,
      storageKey: kPerformanceStorageKey,
      logger: context.logger
    });

    return new VoxelModelEditor({
      runtime: editorRuntime.runtime,
      scene,
      workspace,
      session,
      shell,
      texture,
      target,
      consoleFeatures: registerConsoleFeatures(
        commands,
        [
          pixelArtConsole,
          runtimeConsole,
          archiveConsole
        ],
        {
          keyBindingSettings,
          archives: workspace.archives,
          runtime: editorRuntime
        }
      ),
      disposePerformancePane
    });
  }

  #shell: EditorShell;
  #texture: ModelTextureLease;
  #target: AssetLease<ModelDocument>;
  #consoleFeatures: RegistrationHandle;
  #disposePerformancePane: () => void;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly scene: ModelEditorScene;
  readonly workspace: ModelWorkspace;
  readonly session: EditorSession;

  constructor(
    parts: VoxelModelEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.workspace = parts.workspace;
    this.session = parts.session;
    this.#shell = parts.shell;
    this.#texture = parts.texture;
    this.#target = parts.target;
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
    this.#texture.release();
    this.#target.release();
  }
}
