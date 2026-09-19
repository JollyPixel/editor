// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";
import { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import {
  PIXEL_ART_KIND,
  pixelArtModelKind
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model/network/client.ts";
import {
  EditorRuntime,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { editorState } from "../app/state/index.ts";
import { ModelEditorScene } from "../app/ModelEditorScene.ts";
import type {
  LeftPanel,
  LeftPanelTexture
} from "../app/LeftPanel.ts";
import type { RightPanel } from "../app/RightPanel/RightPanel.ts";
import BlockUvSync from "../features/texture-uv/BlockUvSync.ts";

// CONSTANTS
const kCanvas = "#three-renderer canvas";
const kLocalTextureSize = { x: 64, y: 64 };
export const MODEL_TEXTURE_KIND = pixelArtModelKind();

export interface VoxelModelEditorParts {
  runtime: Runtime;
  scene: ModelEditorScene;
  session: EditorSession;
  disposables: Array<() => void>;
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
    const leftPanel = document.querySelector<LeftPanel>("jolly-model-editor-left-panel")!;
    const rightPanel = document.querySelector<RightPanel>("jolly-model-editor-right-panel")!;
    const leftDock = document.querySelector<HTMLElement>("jolly-dock[side='left']")!;
    const disposables: Array<() => void> = [];

    const texture = openModelTexture(session);
    disposables.push(texture.release);
    leftPanel.setTexture(texture);

    const scene = new ModelEditorScene({
      room: session.target.room,
      identity: session.identity
    });
    const editorRuntime = await EditorRuntime.create(kCanvas, {
      focusCanvas: false,
      viewHelper: true
    });
    const { runtime } = editorRuntime;
    await editorRuntime.load(scene, {
      maxFps: Infinity
    });
    disposables.push(
      editorRuntime.suspendKeyboardOnHover(leftPanel, "canvas-hover-change")
    );

    const { modelSceneComponent } = await scene.ready;
    rightPanel.setModelManager(modelSceneComponent.getModelManager());
    rightPanel.setFolderManager(modelSceneComponent.getFolderManager());
    rightPanel.setSceneManager(modelSceneComponent);
    rightPanel.setPresence(editorState.presence);

    const blockUvSync = new BlockUvSync({
      modelSceneComponent,
      getCanvasManager: () => leftPanel.canvasManager
    });
    leftPanel.setPeerUvDraggingHandler(
      (payload) => blockUvSync.applyPeerDragPreview(payload)
    );

    let updateFrame = requestAnimationFrame(function updateLoop() {
      blockUvSync.update();
      updateFrame = requestAnimationFrame(updateLoop);
    });
    disposables.push(() => cancelAnimationFrame(updateFrame));

    let resizeFrame: number | null = null;
    function scheduleLeftPanelResize(): void {
      if (resizeFrame !== null) {
        return;
      }

      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        leftPanel.onResize();
      });
    }
    leftDock.addEventListener("jolly-resize", scheduleLeftPanelResize);
    leftDock.addEventListener("jolly-resize-end", scheduleLeftPanelResize);
    disposables.push(() => {
      leftDock.removeEventListener("jolly-resize", scheduleLeftPanelResize);
      leftDock.removeEventListener("jolly-resize-end", scheduleLeftPanelResize);
    });

    const { modelEvents } = editorState;
    disposables.push(
      modelEvents.watch("addblock", ({ name, parentId }) => {
        blockUvSync.createBlock(name, parentId ?? null);
      }),
      modelEvents.watch("duplicateblock", ({ sourceUuid, uuid, name }) => {
        blockUvSync.duplicateBlock(sourceUuid, uuid, name);
      }),
      modelEvents.watch("groupMirrored", ({ uuid }) => {
        blockUvSync.refreshFlipAxes(uuid);
      }),
      modelEvents.watch("deleteblock", ({ uuids }) => {
        for (const uuid of uuids) {
          blockUvSync.removeBlock(uuid);
        }
      })
    );
    const unwatchDefaultBlockSeed = modelEvents.watch(
      "modelSnapshotApplied",
      ({ nodes }) => {
        unwatchDefaultBlockSeed();
        if (nodes.length === 0) {
          blockUvSync.createBlock("Block");
        }
      }
    );
    disposables.push(unwatchDefaultBlockSeed);

    return new VoxelModelEditor({
      runtime,
      scene,
      session,
      disposables
    });
  }

  #disposables: Array<() => void>;

  readonly runtime: Runtime;
  readonly scene: ModelEditorScene;
  readonly session: EditorSession;

  constructor(
    parts: VoxelModelEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.session = parts.session;
    this.#disposables = parts.disposables;
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0).reverse()) {
      dispose();
    }
    this.session.dispose();
    this.runtime.dispose();
  }
}

function openModelTexture(
  session: EditorSession
): LeftPanelTexture & { release(): void; } {
  const reference = session.catalog
    .dependenciesOf(session.target.record.id)
    .find((dependency) => dependency.kind === PIXEL_ART_KIND);
  if (reference === undefined) {
    return {
      document: new PixelDocument({ size: kLocalTextureSize }),
      release: () => void 0
    };
  }

  const lease = session.assets.open(MODEL_TEXTURE_KIND, reference.id);

  return {
    document: lease.model,
    room: lease.room,
    release: () => lease.release()
  };
}
