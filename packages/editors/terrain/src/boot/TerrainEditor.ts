// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import {
  TERRAIN_KIND,
  terrainDocumentKind,
  type TerrainCommandDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  EditorRuntime,
  type AssetLease,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import {
  LocalStorageAdapter,
  LogQueue
} from "@jolly-pixel/ui";

import type { TerrainView } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { SculptSettings } from "../features/sculpt/model/SculptSettings.ts";
import "../features/sculpt/toolbar/SculptToolbar.ts";
import { TerrainEditorScene } from "../scene/TerrainEditorScene.ts";
import {
  createTerrainHistory,
  skippedMessage
} from "../shared/terrainHistory.ts";

// CONSTANTS
const kCanvas = "#game-container canvas";
const kTerrainKind = terrainDocumentKind();

export interface TerrainEditorParts {
  runtime: Runtime;
  scene: TerrainEditorScene;
  session: EditorSession;
  target: AssetLease<TerrainCommandDocument>;
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
    const toolbar = document.querySelector("jolly-editor-toolbar");
    if (toolbar !== null) {
      toolbar.sources = context.toolbar;
    }

    const sculpt = new SculptSettings(new LocalStorageAdapter());
    const history = createTerrainHistory(target.document);
    const log = new LogQueue();
    history.on("skipped", (_scope, step) => {
      log.push(skippedMessage(step));
    });
    const activityLog = document.querySelector("jolly-log");
    if (activityLog !== null) {
      log.subscribe((entries) => {
        activityLog.entries = entries;
      });
    }
    const sculptToolbar = document.querySelector("terrain-sculpt-toolbar");
    if (sculptToolbar !== null) {
      sculptToolbar.settings = sculpt;
      sculptToolbar.history = history;
    }

    const scene = new TerrainEditorScene(target.document, sculpt, history);
    await editorRuntime.load(scene);

    return new TerrainEditor({
      runtime: editorRuntime.runtime,
      scene,
      session,
      target
    });
  }

  #target: AssetLease<TerrainCommandDocument>;

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
    this.ready = parts.target.ready;
  }

  get view(): TerrainView | null {
    return this.scene.view;
  }

  get document(): TerrainCommandDocument {
    return this.#target.document;
  }

  dispose(): void {
    this.#target.release();
  }
}
