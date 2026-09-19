// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import {
  DevOptions,
  EditorRuntime,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";
import { VOXEL_MAP_KIND } from "@jolly-pixel/asset.voxel-map/network/client.ts";
import {
  DEFAULT_TILE_SIZE,
  loadTilesets,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../app/state/index.ts";
import { EditorScene } from "../app/EditorScene.ts";
import { ViewFocus } from "../scene/index.ts";
import { EditorShell } from "./EditorShell.ts";
import { TilesetAtlases } from "../features/tilesets/TilesetAtlases.ts";
import {
  LocalTilesetTextures,
  SessionTilesetTextures,
  TILESET_TEXTURE_KIND,
  type TilesetTextures
} from "../features/tilesets/TilesetTextures.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kCanvas = "#game-container > canvas";
const kOfflineTileset: TilesetDefinition = {
  id: "default",
  src: "textures/tileset.png",
  tileSize: DEFAULT_TILE_SIZE
};

export interface VoxelMapDevOptions {
  offline: boolean;
  maxFps: number | undefined;
  samples: number | undefined;
}

export const VOXEL_MAP_DEV_OPTIONS = new DevOptions<VoxelMapDevOptions>({
  offline: DevOptions.flag(),
  maxFps: DevOptions.number(),
  samples: DevOptions.number()
});

export interface VoxelMapEditorParts {
  runtime: Runtime;
  scene: EditorScene;
  shell: EditorShell;
  atlases: TilesetAtlases;
  session?: EditorSession;
}

interface VoxelMapOpenOptions {
  session?: EditorSession;
  dev: VoxelMapDevOptions;
}

export class VoxelMapEditor {
  static readonly accepts = VOXEL_MAP_KIND;
  static readonly identity = {
    title: "Join voxel map"
  };
  static readonly kinds = [TILESET_TEXTURE_KIND];
  static readonly dev = VOXEL_MAP_DEV_OPTIONS;

  static mount(
    context: EditorContext<VoxelMapDevOptions>
  ): Promise<VoxelMapEditor> {
    return VoxelMapEditor.#open({
      session: context.session,
      dev: context.dev
    });
  }

  static openOffline(
    dev: VoxelMapDevOptions
  ): Promise<VoxelMapEditor> {
    return VoxelMapEditor.#open({ dev });
  }

  static async #open(
    options: VoxelMapOpenOptions
  ): Promise<VoxelMapEditor> {
    const { session, dev } = options;
    const viewFocus = new ViewFocus();

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
    const tilesets = session === undefined ?
      await loadTilesets([kOfflineTileset], { manager: runtime.manager }) :
      [];
    const scene = new EditorScene(editorState, {
      defaultLayerName: kDefaultLayerName,
      tilesets,
      voxelRoom: session?.target.room,
      catalog: session?.catalog,
      identity: session?.identity,
      viewFocus,
      samples: dev.samples
    });
    const shell = new EditorShell({
      state: editorState,
      viewFocus,
      runtime: editorRuntime,
      scene
    });
    await editorRuntime.load(scene, {
      maxFps: dev.maxFps ?? Infinity
    });

    const handles = await scene.ready;
    const local = new LocalTilesetTextures(handles.engine);
    const textures: TilesetTextures = session === undefined ?
      local :
      new SessionTilesetTextures(session.assets, local);
    const atlases = new TilesetAtlases({
      engine: handles.engine,
      store: editorState.tilesets,
      textures,
      worldStore: editorState.world
    });
    shell.adoptHandles(handles, textures);

    return new VoxelMapEditor({
      runtime,
      scene,
      shell,
      atlases,
      session
    });
  }

  #shell: EditorShell;
  #atlases: TilesetAtlases;

  readonly runtime: Runtime;
  readonly scene: EditorScene;
  readonly session: EditorSession | undefined;

  constructor(
    parts: VoxelMapEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.session = parts.session;
    this.#shell = parts.shell;
    this.#atlases = parts.atlases;
  }

  dispose(): void {
    this.#atlases.dispose();
    this.#shell.dispose();
    this.session?.dispose();
    this.runtime.dispose();
  }
}
