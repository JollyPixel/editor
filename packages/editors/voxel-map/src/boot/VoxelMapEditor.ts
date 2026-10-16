// Import Third-party Dependencies
import {
  registerConsoleFeatures,
  type RegistrationHandle
} from "@jolly-pixel/console";
import type { Lantern } from "@jolly-pixel/lantern";
import type {
  MetricsPanel,
  Runtime
} from "@jolly-pixel/runtime";
import {
  EditorRuntime,
  archiveConsole,
  peerConsole,
  runtimeConsole,
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
import { BakedRoomEnvironment } from "@jolly-pixel/three";

// Import Internal Dependencies
import { EditorState } from "../state/index.ts";
import { EditorScene } from "./EditorScene.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import { EditorShell } from "../shell/EditorShell.ts";
import { BLOCKSET_DOCUMENT_KIND } from "../features/blocksets/BlocksetBinding.ts";
import { mapConsole } from "./mapConsole.ts";
import { basics } from "../tours/basics.ts";
import { textures } from "../tours/textures.ts";

// CONSTANTS
const kCanvas = "#game-container > canvas";
const kTours = [basics, textures];
const kPerformanceStorageKey = "voxel-map:performance-hud";
const kPerformancePaneKey = "performance";
const kMapKind = voxelMapDocumentKind();

export interface VoxelMapEditorParts {
  runtime: Runtime;
  scene: EditorScene;
  shell: EditorShell;
  workspace: VoxelMapWorkspace;
  session: EditorSession;
  target: AssetLease<SyncedVoxelMap>;
  consoleFeatures: RegistrationHandle;
  metricsPanel: Promise<MetricsPanel>;
  removeInspectorMetrics: () => void;
  lantern: Lantern;
}

export class VoxelMapEditor {
  static readonly accepts = VOXEL_MAP_KIND;
  static readonly identity = {
    title: "Join voxel map"
  };
  static readonly kinds = [kMapKind, BLOCKSET_DOCUMENT_KIND];

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    void BakedRoomEnvironment.load();

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
    const roomEnvironment = await BakedRoomEnvironment.load()
      .catch((error: unknown) => {
        console.warn("[voxel-map] No environment map for reflections.", error);

        return null;
      });

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
          resetWarning: "Every map and blockset stored in this browser is " +
            "deleted. Export what you want to keep first."
        })
      },
      samples: editorRuntime.samples,
      roomEnvironment
    });
    const shell = new EditorShell({
      state,
      runtime: editorRuntime,
      toolbar: context.toolbar
    });
    await editorRuntime.load(scene, {
      maxFps: Infinity
    });

    const workspace = await logger.step(
      "scene",
      () => scene.ready
    );
    shell.adoptWorkspace(workspace);
    const removeInspectorMetrics = runtime.metrics.addSource(
      workspace.view.inspector
    );

    const metricsPanel = logger.step(
      "metrics",
      () => runtime.mountMetricsPanel({
        target: shell.layout ?? undefined,
        floating: true,
        key: kPerformancePaneKey,
        title: "Performance",
        storageKey: kPerformanceStorageKey,
        hidden: editorRuntime.widgets.startsHidden("metrics", true)
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
        [
          mapConsole,
          runtimeConsole,
          archiveConsole,
          peerConsole
        ],
        {
          state: workspace.state,
          archives: workspace.archives,
          runtime: editorRuntime,
          peers: session.workspace?.peers
        }
      ),
      metricsPanel,
      removeInspectorMetrics,
      lantern: context.lantern
    });
  }

  #shell: EditorShell;
  #target: AssetLease<SyncedVoxelMap>;
  #consoleFeatures: RegistrationHandle;
  #metricsPanel: MetricsPanel | null = null;
  #removeInspectorMetrics: () => void;
  #releaseTours: Array<() => void>;
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
    this.#removeInspectorMetrics = parts.removeInspectorMetrics;
    this.#releaseTours = kTours.map((tour) => parts.lantern.register(tour));
    this.ready = Promise.all([
      parts.target.ready,
      parts.scene.ready
    ]).then(() => undefined);

    this.ready.then(() => {
      if (!this.#disposed) {
        parts.lantern.offer(basics);
      }
    }, () => undefined);

    parts.metricsPanel.then((panel) => {
      if (this.#disposed) {
        panel.dispose();
      }
      else {
        this.#metricsPanel = panel;
      }
    }, () => undefined);
  }

  dispose(): void {
    this.#disposed = true;
    this.#metricsPanel?.dispose();
    this.#removeInspectorMetrics();
    this.#consoleFeatures.unregister();
    for (const release of this.#releaseTours) {
      release();
    }
    this.#shell.dispose();
    this.#target.release();
  }
}
