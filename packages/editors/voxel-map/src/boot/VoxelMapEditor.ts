// Import Third-party Dependencies
import {
  registerConsoleFeatures,
  type RegistrationHandle
} from "@jolly-pixel/console";
import type {
  MetricsPanel,
  Runtime
} from "@jolly-pixel/runtime";
import {
  EditorRuntime,
  type AssetLease,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import {
  VOXEL_MAP_KIND,
  voxelMapDocumentKind,
  type SyncedVoxelMap
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import { EditorState } from "../state/index.ts";
import { EditorScene } from "../scene/EditorScene.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import { EditorShell } from "./EditorShell.ts";
import { TILESET_DOCUMENT_KIND } from "../features/tilesets/TilesetBinding.ts";
import { mountInspectorControls } from "./inspectorControls.ts";
import { CONSOLE_FEATURES } from "./consoleFeatures.ts";

// CONSTANTS
const kCanvas = "#game-container > canvas";
const kPerformanceStorageKey = "voxel-map:performance-hud";
const kPerformancePaneKey = "performance";
const kPerformanceToggleKey = "F3";
const kMapKind = voxelMapDocumentKind({
  history: {
    enabled: true
  }
});

export interface VoxelMapEditorParts {
  runtime: Runtime;
  scene: EditorScene;
  shell: EditorShell;
  workspace: VoxelMapWorkspace;
  session: EditorSession;
  target: AssetLease<SyncedVoxelMap>;
  consoleFeatures: RegistrationHandle;
  metricsPanel: Promise<MetricsPanel>;
}

export class VoxelMapEditor {
  static readonly accepts = VOXEL_MAP_KIND;
  static readonly identity = {
    title: "Join voxel map"
  };
  static readonly kinds = [kMapKind, TILESET_DOCUMENT_KIND];

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    return EditorRuntime.create(kCanvas, {
      includePerformanceStats: {
        position: "top-right"
      },
      focusCanvas: false,
      focusHint: true,
      viewHelper: true,
      overlay: {
        container: "#game-container"
      },
      logger
    });
  }

  static async mount(
    context: RuntimeEditorContext
  ): Promise<VoxelMapEditor> {
    const {
      session,
      commands,
      logger,
      runtime: editorRuntime
    } = context;
    const state = new EditorState();
    const target = session.targetLease(kMapKind);

    const { runtime } = editorRuntime;
    const scene = new EditorScene({
      state,
      session: {
        room: target.room,
        map: target.document,
        identity: session.identity,
        catalog: session.catalog,
        assets: session.assets,
        archives: session.archives({
          fallbackName: "map",
          resetWarning: "Every map and tileset stored in this browser is " +
            "deleted. Export what you want to keep first."
        })
      },
      samples: editorRuntime.samples
    });
    const shell = new EditorShell({
      state,
      runtime: editorRuntime
    });
    await editorRuntime.load(scene, {
      maxFps: Infinity
    });

    const workspace = await logger.step(
      "scene",
      () => scene.ready
    );
    shell.adoptWorkspace(workspace);
    runtime.metrics.addSource(workspace.view.inspector);

    const metricsPanel = logger.step(
      "metrics",
      () => runtime.mountMetricsPanel({
        target: shell.layout ?? undefined,
        floating: true,
        key: kPerformancePaneKey,
        title: "Performance [F3]",
        storageKey: kPerformanceStorageKey,
        toggleKey: kPerformanceToggleKey,
        hidden: true
      })
    );

    return new VoxelMapEditor({
      runtime,
      scene,
      shell,
      workspace,
      session,
      target,
      consoleFeatures: registerConsoleFeatures(
        commands,
        CONSOLE_FEATURES,
        workspace
      ),
      metricsPanel
    });
  }

  #shell: EditorShell;
  #target: AssetLease<SyncedVoxelMap>;
  #consoleFeatures: RegistrationHandle;
  #disposed = false;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly scene: EditorScene;
  readonly workspace: VoxelMapWorkspace;
  readonly session: EditorSession;

  constructor(
    parts: VoxelMapEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.session = parts.session;
    this.workspace = parts.workspace;
    this.#shell = parts.shell;
    this.#target = parts.target;
    this.#consoleFeatures = parts.consoleFeatures;
    this.ready = Promise.all([
      parts.target.ready,
      parts.scene.ready
    ]).then(() => undefined);

    parts.metricsPanel.then((panel) => {
      if (this.#disposed) {
        panel.dispose();

        return;
      }

      mountInspectorControls({
        panel,
        view: this.workspace.view
      });
    }, () => undefined);
  }

  dispose(): void {
    this.#disposed = true;
    this.#consoleFeatures.unregister();
    this.#shell.dispose();
    this.#target.release();
    this.session.dispose();
    this.runtime.dispose();
  }
}
