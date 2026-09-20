// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model/network/client.ts";
import {
  EditorRuntime,
  QueryParams,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { ModelEditorScene } from "../scene/index.ts";
import { PresenceStore } from "../state/index.ts";
import { EditorShell } from "./EditorShell.ts";
import {
  MODEL_TEXTURE_KIND,
  openModelTexture,
  type ModelTexture
} from "./modelTexture.ts";

// CONSTANTS
const kCanvas = "#three-renderer canvas";

export interface VoxelModelParams {
  maxFps: number | undefined;
}

export const VOXEL_MODEL_PARAMS = new QueryParams<VoxelModelParams>((query) => {
  return {
    maxFps: query.number("max-fps")
  };
});

export interface VoxelModelEditorParts {
  runtime: Runtime;
  scene: ModelEditorScene;
  session: EditorSession;
  shell: EditorShell;
  texture: ModelTexture;
}

export class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = {
    title: "Join voxel model"
  };
  static readonly kinds = [MODEL_TEXTURE_KIND];

  static async mount(
    context: EditorContext
  ): Promise<VoxelModelEditor> {
    const { session } = context;
    const params = VOXEL_MODEL_PARAMS.read();
    const texture = openModelTexture(session);

    const scene = new ModelEditorScene({
      room: session.target.room,
      identity: session.identity,
      presence: new PresenceStore(),
      pixels: texture.document,
      pixelsReady: texture.ready
    });
    const editorRuntime = await EditorRuntime.create(kCanvas, {
      focusCanvas: false,
      viewHelper: true
    });
    const shell = new EditorShell({
      runtime: editorRuntime,
      texture
    });
    await editorRuntime.load(scene, {
      maxFps: params.maxFps ?? Infinity
    });

    const workspace = await scene.ready;
    shell.adoptWorkspace(workspace);

    return new VoxelModelEditor({
      runtime: editorRuntime.runtime,
      scene,
      session,
      shell,
      texture
    });
  }

  #shell: EditorShell;
  #texture: ModelTexture;

  readonly runtime: Runtime;
  readonly scene: ModelEditorScene;
  readonly session: EditorSession;

  constructor(
    parts: VoxelModelEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.session = parts.session;
    this.#shell = parts.shell;
    this.#texture = parts.texture;
  }

  dispose(): void {
    this.#shell.dispose();
    this.#texture.release();
    this.session.dispose();
    this.runtime.dispose();
  }
}
