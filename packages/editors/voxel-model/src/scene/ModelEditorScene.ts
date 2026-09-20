// Import Third-party Dependencies
import type * as THREE from "three";
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import { Grid } from "@jolly-pixel/three";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  ModelDocument,
  ModelHierarchy
} from "../model/index.ts";
import {
  ModelCollaboration,
  type TransformLock,
  type VoxelModelRoom
} from "../collaboration/index.ts";
import type { PresenceStore } from "../state/index.ts";
import { BlockPicker } from "./BlockPicker.ts";
import { BlockTextures } from "./BlockTextures.ts";
import { TransformGizmo } from "./TransformGizmo.ts";

export interface ModelEditorSceneOptions {
  room: VoxelModelRoom;
  identity: PeerIdentity;
  presence: PresenceStore;
  pixels: PixelDocument;
  pixelsReady: Promise<void>;
}

export interface ModelWorkspace {
  document: ModelDocument;
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
      identity,
      presence,
      pixels,
      pixelsReady
    } = this.#options;
    const scene = this.world.sceneManager.getSource();
    scene.add(createGrid());

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

    const document = new ModelDocument(scene);
    const textures = new BlockTextures({
      pixels,
      pixelsReady,
      document
    });
    const hierarchy = new ModelHierarchy({
      document,
      regions: textures
    });
    const collaboration = new ModelCollaboration({
      room,
      identity,
      document,
      presence,
      world: this.world,
      camera: camera.threeCamera as THREE.PerspectiveCamera
    });
    const gizmo = new TransformGizmo({
      camera,
      canvas: this.world.renderer.canvas,
      scene,
      blocks: document.blocks,
      lock: collaboration.lock,
      live: collaboration.live
    });
    this.world
      .createActor("block-picker")
      .addComponentAndGet(BlockPicker, {
        camera,
        blocks: document.blocks,
        gizmo
      });

    this.#disposables.push(
      () => gizmo.dispose(),
      () => collaboration.dispose(),
      () => textures.dispose()
    );
    room.join();

    this.#workspace.resolve({
      document,
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

function createGrid(): Grid {
  return new Grid({
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
  });
}
