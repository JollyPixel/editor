// Import Third-party Dependencies
import { followCameraPreferences } from "@jolly-pixel/editor.host/viewport";
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import {
  ShortcutLabels,
  type KeyBindingSettings,
  type KeyboardLayoutStore
} from "@jolly-pixel/controls";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import { registerPixelHistory } from "@jolly-pixel/asset.pixel-art/client";
import type { Preferences } from "@jolly-pixel/preferences";
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
  createEditorHistory,
  historyShortcuts,
  type EditorHistory
} from "../features/history/index.ts";
import {
  ANIMATION_SET_DEPENDENCY,
  animationShortcuts,
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
import type { ModelAction } from "../keybindings/modelActions.ts";

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
  preferences: Preferences;
  keyBindings: KeyBindingSettings<ModelAction>;
  keyboardLayout: KeyboardLayoutStore;
}

export interface ModelEditing {
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
  shortcuts: ShortcutLabels<ModelAction>;
  teleportToPeer(clientId: string): void;
}

export class ModelEditorScene extends Systems.Scene {
  #options: ModelEditorSceneOptions;
  #editing = Promise.withResolvers<ModelEditing>();
  #disposables: Array<() => void> = [];
  #viewport: ViewportRenderer | null = null;

  get ready(): Promise<ModelEditing> {
    return this.#editing.promise;
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
    this.#disposables.push(followCameraPreferences(
      camera,
      this.#options.preferences
    ));

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
      this.#options.archives.acceptDependency(ANIMATION_SET_DEPENDENCY, ({ id }) => {
        if (animations.link(id)) {
          animationFocus.focusSet(id);
        }
      }),
      this.#options.keyBindings.bind(this.world.input.keyboard, {
        ...historyShortcuts({ history: activeHistory }),
        ...animationShortcuts({ keyer, selection })
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
      () => activeHistory.dispose(),
      () => unregisterPixels(),
      () => history.dispose(),
      () => access.dispose()
    );

    this.#editing.resolve({
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
      shortcuts: new ShortcutLabels(
        this.#options.keyboardLayout,
        this.#options.keyBindings
      ),
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
    this.#editing.reject(
      new Error("The model editor scene was destroyed before it awoke.")
    );
  }
}
