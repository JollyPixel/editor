// Import Third-party Dependencies
import * as THREE from "three";
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import { Grid } from "@jolly-pixel/three";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { PeerIdentity } from "@jolly-pixel/ui";
import type {
  ModelDocument,
  VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { ModelHierarchy } from "../model/index.ts";
import {
  ModelCollaboration,
  type TransformLock
} from "../collaboration/index.ts";
import type { PresenceStore } from "../state/index.ts";
import { ModelBlocks } from "./blocks/index.ts";
import { BlockPicker } from "./BlockPicker.ts";
import { BlockTextures } from "./textures/index.ts";
import { TransformGizmo } from "./TransformGizmo.ts";

export interface ModelEditorSceneOptions {
  room: VoxelModelRoom;
  document: ModelDocument;
  identity: PeerIdentity;
  presence: PresenceStore;
  pixels: PixelDocument;
  pixelsReady: Promise<void>;
}

export interface ModelWorkspace {
  document: ModelDocument;
  blocks: ModelBlocks;
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
      pixels,
      pixelsReady
    } = this.#options;

    const scene = this.world.sceneManager.getSource();
    scene.background = new THREE.Color("#262627");

    scene.add(
      new THREE.HemisphereLight("#dceaff", "#151820", 2.5),
      new THREE.DirectionalLight("#ffffff", 3)
    );
    scene.add(new Grid({
      extent: 10,
      cell: {
        color: "#3a3a3a",
        thickness: 1.5
      },
      section: {
        show: false
      },
      fade: {
        from: "origin",
        distance: 100
      },
      axes: {
        show: true
      }
    }));

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

    const blocks = new ModelBlocks({
      document,
      scene
    });
    const textures = new BlockTextures({
      pixels,
      pixelsReady,
      document,
      blocks
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
      presence,
      world: this.world,
      camera: camera.camera
    });
    const gizmo = new TransformGizmo({
      camera,
      canvas: this.world.renderer.canvas,
      scene,
      blocks,
      lock: collaboration.lock,
      live: collaboration.live
    });
    this.world
      .createActor("block-picker")
      .addComponentAndGet(BlockPicker, {
        camera,
        blocks,
        gizmo
      });

    this.#disposables.push(
      () => gizmo.dispose(),
      () => collaboration.dispose(),
      () => textures.dispose(),
      () => blocks.dispose()
    );

    this.#workspace.resolve({
      document,
      blocks,
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
