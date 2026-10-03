// Import Third-party Dependencies
import * as THREE from "three";
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type {
  PeerIdentity,
  PresenceSource
} from "@jolly-pixel/ui";
import type { EditorArchives } from "@jolly-pixel/editor.host";
import type {
  ModelDocument,
  VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { ModelHierarchy } from "../model/index.ts";
import { ModelCollaboration } from "../collaboration/index.ts";
import {
  BlockSelectionStore,
  MaterialFocusStore,
  MaterialPreviews,
  type PresenceStore,
  type ViewSettingsStore
} from "../state/index.ts";
import { ModelBlocks } from "./blocks/index.ts";
import { ViewLighting } from "./ViewLighting.ts";
import { ViewGlow } from "./ViewGlow.ts";
import { ViewportRenderer } from "./ViewportRenderer.ts";
import { createRoomEnvironment } from "./roomEnvironment.ts";
import {
  BlockPicker,
  HighlightBridge
} from "../features/selection/index.ts";
import { BlockTextures } from "../features/texture/index.ts";
import {
  TransformGizmo,
  type TransformLock
} from "../features/transform/index.ts";
import { createModelGrid } from "./modelGrid.ts";
import { SceneWaker } from "./SceneWaker.ts";

export interface ModelEditorSceneOptions {
  room: VoxelModelRoom;
  document: ModelDocument;
  identity: PeerIdentity;
  presence: PresenceStore;
  pixels: PixelDocument;
  archives: EditorArchives;
  view: ViewSettingsStore;
}

export interface ModelWorkspace {
  archives: EditorArchives;
  document: ModelDocument;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  materialFocus: MaterialFocusStore;
  hierarchy: ModelHierarchy;
  textures: BlockTextures;
  gizmo: TransformGizmo;
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
      identity,
      presence,
      pixels,
      view
    } = this.#options;

    const scene = this.world.sceneManager.getSource();
    scene.background = new THREE.Color("#262627");

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

    const selection = new BlockSelectionStore();
    const materialFocus = new MaterialFocusStore();
    const previews = new MaterialPreviews();
    const blocks = new ModelBlocks({
      document,
      scene,
      selection,
      previews
    });

    const lighting = new ViewLighting({
      scene,
      view
    });
    const unfollowShading = view.follow((settings) => {
      blocks.lit = settings.shading === "lit";
    });
    lighting
      .useEnvironment(createRoomEnvironment(this.world.renderer.getSource()))
      .then(
        () => this.world.invalidate(),
        (error: unknown) => {
          console.warn("[voxel-model] No environment map for the viewport.", error);
        }
      );

    const textures = new BlockTextures({
      pixels,
      document,
      blocks,
      selection,
      requestFrame: () => this.world.invalidate()
    });
    const hierarchy = new ModelHierarchy({
      document,
      textureSize: () => pixels.size(),
      poses: blocks
    });
    const collaboration = new ModelCollaboration({
      room,
      identity,
      document,
      blocks,
      selection,
      materialFocus,
      previews,
      presence,
      world: this.world,
      camera: camera.camera
    });
    const gizmo = new TransformGizmo({
      camera,
      canvas: this.world.renderer.canvas,
      scene,
      blocks,
      selection,
      lock: collaboration.lock,
      live: collaboration.live
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
    const glow = new ViewGlow({
      target: viewport,
      view
    });
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
      () => waker.dispose(),
      () => this.world.renderer.removeRenderComponent(viewport),
      () => glow.dispose(),
      () => highlight.dispose(),
      () => gizmo.dispose(),
      () => collaboration.dispose(),
      () => textures.dispose(),
      () => lighting.dispose(),
      unfollowShading,
      () => blocks.dispose()
    );

    this.#workspace.resolve({
      archives: this.#options.archives,
      document,
      blocks,
      selection,
      materialFocus,
      hierarchy,
      textures,
      gizmo,
      lock: collaboration.lock,
      presence,
      fields: collaboration.fields,
      previews,
      view,
      teleportToPeer: (clientId) => {
        const pose = collaboration.frustums.poseOf(clientId);
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
