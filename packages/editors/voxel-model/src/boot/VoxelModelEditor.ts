// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import {
  VOXEL_MODEL_KIND,
  voxelModelDocumentKind,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/network/client.ts";
import {
  EditorRuntime,
  type AssetLease,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  ModelEditorScene,
  type ModelWorkspace
} from "../scene/index.ts";
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

export interface VoxelModelEditorParts {
  runtime: Runtime;
  scene: ModelEditorScene;
  workspace: ModelWorkspace;
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
      maxFps: Infinity
    });

    const workspace = await scene.ready;
    shell.adoptWorkspace(workspace);

    return new VoxelModelEditor({
      runtime: editorRuntime.runtime,
      scene,
      workspace,
      session,
      shell,
      texture,
      target
    });
  }

  #shell: EditorShell;
  #texture: ModelTexture;
  #target: AssetLease<ModelDocument>;

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
    this.ready = Promise.all([
      parts.target.ready,
      parts.texture.ready,
      parts.scene.ready
    ]).then(() => undefined);
  }

  dispose(): void {
    this.#shell.dispose();
    this.#texture.release();
    this.#target.release();
    this.session.dispose();
    this.runtime.dispose();
  }
}
