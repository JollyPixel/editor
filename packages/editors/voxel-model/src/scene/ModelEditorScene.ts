// Import Third-party Dependencies
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import { registerPixelHistory } from "@jolly-pixel/asset.pixel-art/client";
import type { PresenceSource } from "@jolly-pixel/ui";
import type { EditorArchives } from "@jolly-pixel/editor.host";
import type {
  ModelDocument,
  VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";
import { RoomGrants } from "@jolly-pixel/network/client";
import type { BakedRoomEnvironment } from "@jolly-pixel/three";

// Import Internal Dependencies
import { ModelHierarchy } from "../model/index.ts";
import { ModelCollaboration } from "../collaboration/index.ts";
import {
  BlockSelectionStore,
  MaterialFocusStore,
  MaterialPreviews,
  TabStore,
  isLit,
  type AnimationFocusStore,
  type PresenceStore,
  type ViewSettingsStore
} from "../state/index.ts";
import { ModelBlocks } from "./blocks/index.ts";
import { ViewLighting } from "./ViewLighting.ts";
import { ViewGlow } from "./ViewGlow.ts";
import { ViewportRenderer } from "./ViewportRenderer.ts";
import {
  BlockPicker,
  HighlightBridge
} from "../features/selection/index.ts";
import { BlockTextures } from "../features/texture/index.ts";
import {
  TransformGizmo,
  TransformTool,
  restTarget,
  type TransformLock
} from "../features/transform/index.ts";
import {
  ActiveHistory,
  bindHistoryShortcuts,
  createEditorHistory,
  type EditorHistory
} from "../features/history/index.ts";
import {
  bindAnimationShortcuts,
  createAnimation,
  type AnimationKeyer,
  type AnimationLibrary,
  type AnimationSession,
  type AnimationSetSource,
  type ClipRemovalFocus,
  type KeyEditor
} from "../features/animation/index.ts";
import { createModelGrid } from "./modelGrid.ts";
import { SceneWaker } from "./SceneWaker.ts";
import {
  MODEL_CAPABILITIES,
  type ModelGrants
} from "../access/ModelAccess.ts";

// CONSTANTS
const kMaxAccessListeners = 32;

export interface ModelEditorSceneOptions {
  room: VoxelModelRoom;
  document: ModelDocument;
  presence: PresenceStore;
  pixels: PixelDocument;
  animationSets: AnimationSetSource;
  archives: EditorArchives;
  view: ViewSettingsStore;
  roomEnvironment: BakedRoomEnvironment | null;
}

export interface ModelWorkspace {
  access: ModelGrants;
  archives: EditorArchives;
  document: ModelDocument;
  history: EditorHistory;
  activeHistory: ActiveHistory;
  tab: TabStore;
  animations: AnimationLibrary;
  animationFocus: AnimationFocusStore;
  clipRemoval: ClipRemovalFocus;
  animationSession: AnimationSession;
  keyEditor: KeyEditor;
  keyer: AnimationKeyer;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  materialFocus: MaterialFocusStore;
  hierarchy: ModelHierarchy;
  textures: BlockTextures;
  gizmo: TransformGizmo;
  tool: TransformTool;
  lock: TransformLock;
  presence: PresenceStore;
  fields: PresenceSource;
  previews: MaterialPreviews;
  view: ViewSettingsStore;
  teleportToPeer(clientId: string): void;
}

export class ModelEditorScene extends Systems.Scene {
  #options: ModelEditorSceneOptions;
  #workspace = Promise.withResolvers<ModelWorkspace>();
  #disposables: Array<() => void> = [];
  #viewport: ViewportRenderer | null = null;

  get ready(): Promise<ModelWorkspace> {
    return this.#workspace.promise;
  }

  constructor(
    options: ModelEditorSceneOptions
  ) {
    super("model-editor");
    this.#options = options;
  }

  override awake(): void {
    const {
      room,
      document,
      presence,
      pixels,
      view
    } = this.#options;

    const scene = this.world.sceneManager.getSource();
    scene.add(createModelGrid());

    const camera = this.world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "elastic",
        position: { x: 0, y: 1, z: 5 },
        pivotPosition: { x: 0, y: 2, z: 0 },
        pitch: -0.3,
        moveSpeed: 6,
        minMoveSpeed: 1,
        maxMoveSpeed: 60,
        scrollSpeed: 1,
        maxPivotDistance: 20,
        initialTrailDistance: 12
      });

    const access = new RoomGrants(room, MODEL_CAPABILITIES)
      .setMaxListeners(kMaxAccessListeners);
    const history = createEditorHistory({ document });
    const unregisterPixels = registerPixelHistory(history, pixels, { scope: "build" });
    const tab = new TabStore();
    const selection = new BlockSelectionStore();
    const materialFocus = new MaterialFocusStore();
    const previews = new MaterialPreviews();
    const blocks = new ModelBlocks({
      document,
      scene,
      selection,
      previews
    });
    const animation = createAnimation({
      access,
      document,
      history,
      tab,
      presence,
      source: this.#options.animationSets,
      blocks,
      requestFrame: () => this.world.invalidate()
    });
    const {
      animations,
      animationFocus,
      clipRemoval,
      animationSession,
      keyEditor,
      keyer
    } = animation;
    const activeHistory = new ActiveHistory({
      history,
      tab,
      animate: animation.historyFocus,
      access
    });

    const lighting = new ViewLighting({
      scene,
      view,
      environment: this.#options.roomEnvironment
        ?.createRenderTarget(this.world.renderer.getSource()) ?? null,
      casters: () => blocks.visibleMeshes()
    });
    const unfollowLit = view.follow((settings) => {
      blocks.lit = isLit(settings);
    });

    const textures = new BlockTextures({
      pixels,
      document,
      blocks,
      selection,
      access,
      requestFrame: () => this.world.invalidate()
    });
    const hierarchy = new ModelHierarchy({
      document,
      edits: animation.buildEdits,
      textureSize: () => pixels.size(),
      poses: blocks,
      access
    });
    const collaboration = new ModelCollaboration({
      room,
      document,
      blocks,
      selection,
      materialFocus,
      previews,
      presence,
      animate: {
        session: animationSession,
        keyEditor,
        liveView: animation.liveView
      },
      world: this.world,
      camera: camera.camera
    });
    const rest = restTarget({ blocks, lock: collaboration.lock, access });
    const tool = new TransformTool(rest);
    const gizmo = new TransformGizmo({
      camera,
      canvas: this.world.renderer.canvas,
      scene,
      blocks,
      selection,
      lock: collaboration.lock,
      live: collaboration.live,
      tool
    });
    this.world
      .createActor("block-picker")
      .addComponentAndGet(BlockPicker, {
        camera,
        blocks,
        selection,
        gizmo
      });

    const viewport = new ViewportRenderer(camera);
    this.#viewport = viewport;
    const highlight = new HighlightBridge({
      renderer: this.world.renderer.getSource(),
      scene,
      camera: camera.threeCamera,
      blocks,
      selection,
      presence
    });
    viewport.addPreDrawStep(highlight.update);
    viewport.addPreDrawStep(lighting.shadow.update);
    function invalidateShadow(): void {
      lighting.shadow.invalidate();
    }
    this.world.renderer.on("compiled", invalidateShadow);
    const glow = new ViewGlow({
      target: viewport,
      view,
      glows: () => blocks.glows
    });
    viewport.addPreDrawStep(glow.update);
    const waker = new SceneWaker({
      document,
      previews,
      pixels,
      presence,
      lock: collaboration.lock,
      view,
      requestFrame: () => this.world.invalidate()
    });
    this.#disposables.push(
      animationSession.subscribe("active", (active) => {
        tool.use(active ? keyer : rest);
      }),
      access.subscribe("change", () => tool.emit("change")),
      bindAnimationShortcuts({
        keyboard: this.world.input.keyboard,
        keyer,
        selection
      }),
      () => animation.dispose(),
      () => waker.dispose(),
      () => this.world.renderer.removeRenderComponent(viewport),
      () => glow.dispose(),
      () => highlight.dispose(),
      () => gizmo.dispose(),
      () => collaboration.dispose(),
      () => textures.dispose(),
      () => lighting.dispose(),
      () => this.world.renderer.off("compiled", invalidateShadow),
      unfollowLit,
      () => blocks.dispose(),
      bindHistoryShortcuts({
        keyboard: this.world.input.keyboard,
        history: activeHistory
      }),
      () => activeHistory.dispose(),
      () => unregisterPixels(),
      () => history.dispose(),
      () => access.dispose()
    );

    this.#workspace.resolve({
      access,
      archives: this.#options.archives,
      document,
      history,
      activeHistory,
      tab,
      animations,
      animationFocus,
      clipRemoval,
      animationSession,
      keyEditor,
      keyer,
      blocks,
      selection,
      materialFocus,
      hierarchy,
      textures,
      gizmo,
      tool,
      lock: collaboration.lock,
      presence,
      fields: collaboration.fields,
      previews,
      view,
      teleportToPeer: (clientId) => {
        const pose = collaboration.frustums.peerPose(clientId);
        if (pose !== undefined) {
          camera.teleport(pose);
        }
      }
    });
  }

  override start(): void {
    this.#viewport?.replaceCamera(this.world.renderer);
  }

  override destroy(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
    this.#workspace.reject(
      new Error("The model editor scene was destroyed before it awoke.")
    );
  }
}
