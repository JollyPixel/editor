// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import {
  TERRAIN_KIND,
  terrainDocumentKind,
  type TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  EditorRuntime,
  type AssetLease,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import type { TerrainView } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { TerrainEditorScene } from "../scene/TerrainEditorScene.ts";
import { mountEditorShell } from "../shell/EditorShell.ts";
import { createEditing } from "./createEditing.ts";

// CONSTANTS
const kCanvas = "#game-container canvas";
const kTerrainKind = terrainDocumentKind();

export interface TerrainEditorParts {
  runtime: Runtime;
  scene: TerrainEditorScene;
  session: EditorSession;
  target: AssetLease<TerrainDocument>;
  disposables: Array<() => void>;
}

export class TerrainEditor {
  static readonly accepts = TERRAIN_KIND;
  static readonly identity = {
    title: "Join terrain"
  };
  static readonly kinds = [kTerrainKind];

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    return EditorRuntime.create(kCanvas, {
      includePerformanceStats: {
        position: "top-right"
      },
      focusCanvas: false,
      viewHelper: true,
      logger
    });
  }

  static async mount(
    context: RuntimeEditorContext
  ): Promise<TerrainEditor> {
    const {
      session,
      runtime: editorRuntime
    } = context;
    const target = session.targetLease(kTerrainKind);
    const disposables: Array<() => void> = [];
    try {
      const editing = createEditing(context, target, disposables);
      const scene = new TerrainEditorScene(editing);
      const { sceneManager } = editorRuntime.runtime.world;
      disposables.push(() => sceneManager.unloadScene(scene));
      await editorRuntime.load(scene);
      mountEditorShell({
        context,
        editing,
        teleportToPeer: (clientId) => scene.teleportToPeer(clientId)
      }, disposables);

      return new TerrainEditor({
        runtime: editorRuntime.runtime,
        scene,
        session,
        target,
        disposables
      });
    }
    catch (error) {
      disposeAll(disposables);

      throw error;
    }
  }

  #target: AssetLease<TerrainDocument>;
  #disposables: Array<() => void>;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly scene: TerrainEditorScene;
  readonly session: EditorSession;

  constructor(
    parts: TerrainEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.session = parts.session;
    this.#target = parts.target;
    this.#disposables = parts.disposables;
    this.ready = parts.target.ready;
  }

  get view(): TerrainView {
    return this.scene.view;
  }

  get document(): TerrainDocument {
    return this.#target.document;
  }

  dispose(): void {
    disposeAll(this.#disposables);
  }
}

function disposeAll(
  disposables: Array<() => void>
): void {
  for (const dispose of disposables.splice(0).reverse()) {
    dispose();
  }
}
