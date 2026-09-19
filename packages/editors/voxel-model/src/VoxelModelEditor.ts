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
import type {
  LeftPanel,
  LeftPanelTexture
} from "./app/LeftPanel.ts";
import type { RightPanel } from "./app/RightPanel.ts";
import { ModelEditorScene } from "./scene/index.ts";
import { PresenceStore } from "./state/index.ts";

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
      identity: session.identity,
      presence: new PresenceStore(),
      pixels: texture.document
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

    const workspace = await scene.ready;
    void rightPanel.attach(workspace);
    leftPanel.onPeerUvDragging = (payload) => workspace.textures.previewPeerDrag(payload);

    disposables.push(followDockResize(leftDock, () => leftPanel.onResize()));

    const { document: model, hierarchy } = workspace;
    function seedDefaultBlock(): void {
      if (model.blocks.size === 0) {
        hierarchy.createBlock("Block", null);
      }
    }
    model.once("reset", seedDefaultBlock);
    disposables.push(() => model.off("reset", seedDefaultBlock));

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

function followDockResize(
  dock: HTMLElement,
  onResize: () => void
): () => void {
  let frame: number | null = null;
  function schedule(): void {
    if (frame !== null) {
      return;
    }

    frame = requestAnimationFrame(() => {
      frame = null;
      onResize();
    });
  }

  dock.addEventListener("jolly-resize", schedule);
  dock.addEventListener("jolly-resize-end", schedule);

  return () => {
    dock.removeEventListener("jolly-resize", schedule);
    dock.removeEventListener("jolly-resize-end", schedule);
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
  };
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
