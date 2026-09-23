// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import {
  QueryParams,
  EditorRuntime,
  type AssetLease,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";
import {
  VOXEL_MAP_KIND,
  voxelMapDocumentKind,
  type SyncedVoxelMap
} from "@jolly-pixel/asset.voxel-map/network/client.ts";

// Import Internal Dependencies
import { EditorState } from "../state/index.ts";
import {
  EditorScene,
  type VoxelMapWorkspace
} from "../scene/EditorScene.ts";
import { ViewFocus } from "../scene/index.ts";
import { EditorShell } from "./EditorShell.ts";
import { TILESET_TEXTURE_KIND } from "../features/tilesets/TilesetTextures.ts";
import {
  mountInspectorControls
} from "../features/performance/index.ts";
import { MapArchives } from "../features/map-config/MapArchives.ts";

// CONSTANTS
const kCanvas = "#game-container > canvas";
const kPerformanceStorageKey = "voxel-map:performance-hud";
const kPerformancePaneKey = "performance";
const kPerformanceToggleKey = "F3";
const kMapKind = voxelMapDocumentKind({
  chunkSize: 16,
  history: {
    enabled: true
  }
});

export interface VoxelMapParams {
  offline: boolean;
}

export const VOXEL_MAP_PARAMS = new QueryParams<VoxelMapParams>((query) => {
  return {
    offline: query.flag("offline")
  };
});

export interface VoxelMapEditorParts {
  runtime: Runtime;
  scene: EditorScene;
  shell: EditorShell;
  workspace: VoxelMapWorkspace;
  session: EditorSession;
  target: AssetLease<SyncedVoxelMap>;
}

export class VoxelMapEditor {
  static readonly accepts = VOXEL_MAP_KIND;
  static readonly identity = {
    title: "Join voxel map"
  };
  static readonly kinds = [kMapKind, TILESET_TEXTURE_KIND];

  static async mount(
    context: EditorContext
  ): Promise<VoxelMapEditor> {
    const { session } = context;
    const state = new EditorState();
    const viewFocus = new ViewFocus();
    const target = session.targetLease(kMapKind);

    const editorRuntime = await EditorRuntime.create(kCanvas, {
      includePerformanceStats: {
        position: "top-right"
      },
      focusCanvas: false,
      focusHint: true,
      viewHelper: true,
      overlay: {
        container: "#game-container"
      }
    });
    const { runtime } = editorRuntime;
    const scene = new EditorScene({
      state,
      viewFocus,
      session: {
        room: target.room,
        map: target.document,
        identity: session.identity,
        catalog: session.catalog,
        assets: session.assets,
        archives: new MapArchives({
          archive: session.archive,
          workspace: session.workspace,
          accepts: VoxelMapEditor.accepts,
          target: () => session.catalog.record(session.target.record.id) ??
            session.target.record
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

    const workspace = await scene.ready;
    shell.adoptWorkspace(workspace);
    runtime.metrics.addSource(workspace.engine.inspector);

    const panel = await runtime.mountMetricsPanel({
      target: shell.layout ?? undefined,
      floating: true,
      key: kPerformancePaneKey,
      title: "Performance [F3]",
      storageKey: kPerformanceStorageKey,
      toggleKey: kPerformanceToggleKey,
      hidden: true
    });
    mountInspectorControls({
      panel,
      engine: workspace.engine
    });

    return new VoxelMapEditor({
      runtime,
      scene,
      shell,
      workspace,
      session,
      target
    });
  }

  #shell: EditorShell;
  #target: AssetLease<SyncedVoxelMap>;

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
    this.ready = Promise.all([
      parts.target.ready,
      parts.scene.ready
    ]).then(() => undefined);
  }

  dispose(): void {
    this.#shell.dispose();
    this.#target.release();
    this.session.dispose();
    this.runtime.dispose();
  }
}
