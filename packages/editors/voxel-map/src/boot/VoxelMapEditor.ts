// Import Third-party Dependencies
import {
  Runtime,
  type RuntimeCanvasTarget
} from "@jolly-pixel/runtime";
import type { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { editorState } from "../app/state/index.ts";
import { EditorScene } from "../app/EditorScene.ts";
import { ViewFocus } from "../scene/index.ts";
import { EditorSession } from "./EditorSession.ts";
import { EditorShell } from "./EditorShell.ts";
import { preloadOfflineTilesets } from "./assets/preloadOfflineTilesets.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";

export interface VoxelMapEditorOptions {
  canvas: RuntimeCanvasTarget;
  offline?: boolean;
  world?: AssetId;
}

export interface VoxelMapEditorParts {
  runtime: Runtime;
  scene: EditorScene;
  shell: EditorShell;
  session?: EditorSession;
}

export class VoxelMapEditor {
  static async open(
    options: VoxelMapEditorOptions
  ): Promise<VoxelMapEditor> {
    const {
      canvas,
      offline = false,
      world
    } = options;

    const runtime = await Runtime.create(canvas, {
      includePerformanceStats: {
        position: "top-right"
      },
      focusCanvas: false,
      focusHint: true,
      overlay: {
        container: "#game-container"
      }
    });
    const session = offline
      ? undefined
      : await EditorSession.open({ world });
    await session?.catalog.ready;
    const tilesets = session === undefined ?
      await preloadOfflineTilesets(runtime.manager) :
      [];

    const viewFocus = new ViewFocus();
    const scene = new EditorScene(editorState, {
      defaultLayerName: kDefaultLayerName,
      tilesets,
      voxelRoom: session?.worldRoom,
      catalog: session?.catalog,
      identity: session?.identity,
      viewFocus
    });
    const shell = new EditorShell({
      state: editorState,
      viewFocus,
      input: runtime.world.input,
      scene,
      textureRooms: session === undefined ?
        undefined :
        (assetId) => session.textureRoom(assetId)
    });

    await runtime.load({
      scene,
      skipLoadingScreen: true,
      maxFps: Infinity
    });
    shell.adoptHandles(await scene.ready);

    return new VoxelMapEditor({
      runtime,
      scene,
      shell,
      session
    });
  }

  #shell: EditorShell;

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
  }

  dispose(): void {
    this.#shell.dispose();
    this.session?.dispose();
    this.runtime.dispose();
  }
}
