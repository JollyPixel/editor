// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import {
  VOXEL_MODEL_KIND,
  voxelModelDocumentKind,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/network/client.ts";
import {
  EditorRuntime,
  QueryParams,
  type AssetLease,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { ModelEditorScene } from "../scene/index.ts";
import { PresenceStore } from "../state/index.ts";
import { EditorShell } from "./EditorShell.ts";
import {
  TEXTURE_DOCUMENT_KIND,
  openModelTexture,
  type ModelTexture
} from "./modelTexture.ts";

// CONSTANTS
const kCanvas = "#three-renderer canvas";
const kModelKind = voxelModelDocumentKind();

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
  target: AssetLease<ModelDocument>;
}

export class VoxelModelEditor {
  static readonly accepts = VOXEL_MODEL_KIND;
  static readonly identity = {
    title: "Join voxel model"
  };
  static readonly kinds = [kModelKind, TEXTURE_DOCUMENT_KIND];

  static async mount(
    context: EditorContext
  ): Promise<VoxelModelEditor> {
    const { session } = context;
    const params = VOXEL_MODEL_PARAMS.read();
    const texture = openModelTexture(session);
    const target = session.targetLease(kModelKind);

    const scene = new ModelEditorScene({
      room: target.room,
      document: target.document,
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
      texture,
      target
    });
  }

  #shell: EditorShell;
  #texture: ModelTexture;
  #target: AssetLease<ModelDocument>;

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
    this.#target = parts.target;
  }

  dispose(): void {
    this.#shell.dispose();
    this.#texture.release();
    this.#target.release();
    this.session.dispose();
    this.runtime.dispose();
  }
}
