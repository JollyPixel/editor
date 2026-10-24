// Import Third-party Dependencies
import type { RegistrationHandle } from "@jolly-pixel/console";
import type { Lantern } from "@jolly-pixel/lantern";
import type { Runtime } from "@jolly-pixel/runtime";
import {
  EditorRuntime,
  provideTourKeys,
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
import { PIXEL_ART_KEYBINDINGS } from "@jolly-pixel/editor.pixel-art/preferences";
import type { PaneVisibilityDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorState } from "../state/index.ts";
import { EditorScene } from "./EditorScene.ts";
import type { VoxelMapEditing } from "../editing/VoxelMapEditing.ts";
import { EditorShell } from "../shell/EditorShell.ts";
import { BLOCKSET_DOCUMENT_KIND } from "../features/blocksets/BlocksetBinding.ts";
import { mapConsole } from "./mapConsole.ts";
import { basics } from "../tours/basics.ts";
import {
  MAP_TOURS,
  MAP_TOUR_KEYS,
  PANE_TOURS,
  PIXEL_ART_TOUR_KEYS
} from "../tours/mapTours.ts";
import { VOXEL_MAP_KEYBINDINGS } from "../preferences.ts";

// CONSTANTS
const kCanvas = "#game-container > canvas";
const kPerformanceStorageKey = "voxel-map:performance-hud";
const kMapKind = voxelMapDocumentKind();

export interface VoxelMapEditorParts {
  runtime: Runtime;
  scene: EditorScene;
  shell: EditorShell;
  editing: VoxelMapEditing;
  session: EditorSession;
  target: AssetLease<SyncedVoxelMap>;
  consoleFeatures: RegistrationHandle;
  disposePerformancePane: () => void;
  removeInspectorMetrics: () => void;
  lantern: Lantern;
}

export class VoxelMapEditor {
  static readonly accepts = VOXEL_MAP_KIND;
  static readonly identity = {
    title: "Join voxel map"
  };
  static readonly kinds = [kMapKind, BLOCKSET_DOCUMENT_KIND];
  static readonly archive = {
    fallbackName: "map",
    resetWarning: "Every map and blockset stored in this browser is " +
      "deleted. Export what you want to keep first."
  };

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    void BakedRoomEnvironment.load();

    return EditorRuntime.create(kCanvas, {
      includePerformanceStats: {
        position: "top-right"
      },
      renderer: {
        webgpu: {
          antialias: false
        }
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
      preferences,
      runtime: editorRuntime
    } = context;
    const state = new EditorState({
      preferences,
      keyboardLayout: context.keyboardLayout
    });
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
        archives: context.archives
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

    const editing = await logger.step(
      "scene",
      () => scene.ready
    );
    shell.adoptEditing(editing);
    const removeInspectorMetrics = runtime.metrics.addSource(
      editing.view.inspector
    );

    const disposePerformancePane = editorRuntime.mountPerformancePane({
      target: shell.layout ?? undefined,
      storageKey: kPerformanceStorageKey,
      logger
    });

    return new VoxelMapEditor({
      runtime,
      scene,
      shell,
      editing,
      session,
      target,
      consoleFeatures: mapConsole(commands, {
        state: editing.state
      }),
      disposePerformancePane,
      removeInspectorMetrics,
      lantern: context.lantern
    });
  }

  #shell: EditorShell;
  #consoleFeatures: RegistrationHandle;
  #disposePerformancePane: () => void;
  #removeInspectorMetrics: () => void;
  #lantern: Lantern;
  #lanternReleases: Array<() => void>;
  #disposed = false;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly scene: EditorScene;
  readonly editing: VoxelMapEditing;
  readonly session: EditorSession;

  constructor(
    parts: VoxelMapEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.session = parts.session;
    this.editing = parts.editing;
    this.#shell = parts.shell;
    this.#consoleFeatures = parts.consoleFeatures;
    this.#removeInspectorMetrics = parts.removeInspectorMetrics;
    this.#disposePerformancePane = parts.disposePerformancePane;
    this.#lantern = parts.lantern;
    this.#lanternReleases = [
      ...MAP_TOURS.map((tour) => parts.lantern.register(tour)),
      provideTourKeys({
        lantern: parts.lantern,
        preferences: parts.editing.state.preferences,
        scope: VOXEL_MAP_KEYBINDINGS,
        layout: parts.editing.state.keyboardLayout,
        namespace: MAP_TOUR_KEYS
      }),
      provideTourKeys({
        lantern: parts.lantern,
        preferences: parts.editing.state.preferences,
        scope: PIXEL_ART_KEYBINDINGS,
        layout: parts.editing.state.keyboardLayout,
        namespace: PIXEL_ART_TOUR_KEYS
      })
    ];
    this.ready = Promise.all([
      parts.target.ready,
      parts.scene.ready
    ]).then(() => undefined);

    this.ready.then(() => {
      if (!this.#disposed) {
        parts.lantern.offer(basics);
        parts.shell.layout?.addEventListener("jolly-pane-visibility", this.#offerPaneTour);
      }
    }, () => undefined);
  }

  readonly #offerPaneTour = (
    event: CustomEvent<PaneVisibilityDetail>
  ): void => {
    const tour = PANE_TOURS.get(event.detail.pane);
    if (event.detail.visible && tour !== undefined) {
      this.#lantern.offer(tour);
    }
  };

  dispose(): void {
    this.#disposed = true;
    this.#shell.layout?.removeEventListener("jolly-pane-visibility", this.#offerPaneTour);
    this.#disposePerformancePane();
    this.#removeInspectorMetrics();
    this.#consoleFeatures.unregister();
    for (const release of this.#lanternReleases) {
      release();
    }
    this.#shell.dispose();
  }
}
