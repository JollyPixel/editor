// Import Third-party Dependencies
import * as THREE from "three";
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { PeerIdentity } from "@jolly-pixel/ui";
import type {
  ModelDocument,
  VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { ModelHierarchy } from "../model/index.ts";
import { ModelCollaboration } from "../collaboration/index.ts";
import {
  BlockSelectionStore,
  type PresenceStore
} from "../state/index.ts";
import { ModelBlocks } from "./blocks/index.ts";
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

export interface ModelEditorSceneOptions {
  room: VoxelModelRoom;
  document: ModelDocument;
  identity: PeerIdentity;
  presence: PresenceStore;
  pixels: PixelDocument;
}

export interface ModelWorkspace {
  document: ModelDocument;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  hierarchy: ModelHierarchy;
  textures: BlockTextures;
  gizmo: TransformGizmo;
  lock: TransformLock;
  presence: PresenceStore;
  teleportToPeer(clientId: string): void;
}

export class ModelEditorScene extends Systems.Scene {
  #options: ModelEditorSceneOptions;
  #workspace = Promise.withResolvers<ModelWorkspace>();
  #disposables: Array<() => void> = [];

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
      pixels
    } = this.#options;

    const scene = this.world.sceneManager.getSource();
    scene.background = new THREE.Color("#262627");

    scene.add(
      new THREE.HemisphereLight("#dceaff", "#151820", 2.5),
      new THREE.DirectionalLight("#ffffff", 3)
    );
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
    const blocks = new ModelBlocks({
      document,
      scene,
      selection
    });

    const textures = new BlockTextures({
      pixels,
      document,
      blocks,
      selection
    });
    const hierarchy = new ModelHierarchy({
      document,
      regions: textures,
      poses: blocks
    });
    const collaboration = new ModelCollaboration({
      room,
      identity,
      blocks,
      selection,
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

    this.world.renderer.removeRenderComponent(camera);
    const highlight = new HighlightBridge({
      renderer: this.world.renderer.getSource(),
      scene,
      camera,
      blocks,
      selection,
      presence
    });
    this.world.renderer.addRenderComponent(highlight);

    this.#disposables.push(
      () => highlight.dispose(),
      () => gizmo.dispose(),
      () => collaboration.dispose(),
      () => textures.dispose(),
      () => blocks.dispose()
    );

    this.#workspace.resolve({
      document,
      blocks,
      selection,
      hierarchy,
      textures,
      gizmo,
      lock: collaboration.lock,
      presence,
      teleportToPeer: (clientId) => {
        const pose = collaboration.frustums.poseOf(clientId);
        if (pose !== undefined) {
          camera.teleport(pose);
        }
      }
    });
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
