// Import Third-party Dependencies
import {
  OrbitFlyCamera,
  Systems
} from "@jolly-pixel/engine";
import type {
  TerrainChange,
  TerrainCommandDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "@jolly-pixel/terrain.renderer";
import { TerrainRenderer } from "@jolly-pixel/terrain.renderer/engine";
import * as THREE from "three";

export class TerrainEditorScene extends Systems.Scene {
  #document: TerrainCommandDocument;
  #disposables: Array<() => void> = [];

  constructor(
    document: TerrainCommandDocument
  ) {
    super("terrain-editor");
    this.#document = document;
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    const sun = new THREE.DirectionalLight("#fff4e0", 2.4);
    sun.position.set(-0.6, 1, 0.35);
    scene.add(sun, new THREE.HemisphereLight("#b9d4ff", "#4a3f30", 0.9));

    const camera = this.world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "elastic",
        position: { x: CHUNK_SAMPLES * 1.5, y: CHUNK_SAMPLES, z: CHUNK_SAMPLES * 1.5 },
        pivotPosition: { x: CHUNK_SAMPLES / 2, y: 0, z: CHUNK_SAMPLES / 2 },
        pitch: -0.5,
        moveSpeed: 40,
        minMoveSpeed: 5,
        maxMoveSpeed: 400,
        scrollSpeed: 4,
        maxPivotDistance: CHUNK_SAMPLES * 16,
        initialTrailDistance: CHUNK_SAMPLES * 1.5
      });

    const { view } = this.world
      .createActor("terrain")
      .addComponentAndGet(TerrainRenderer, {
        terrain: this.#document.terrain,
        camera: () => camera.camera
      });

    const onChange = ({ command }: TerrainChange): void => {
      const coord = new ChunkCoord(command.x, command.z);
      if (command.action === "chunk-added") {
        view.chunkAdded(coord);
      }
      else {
        view.chunkRemoved(coord);
      }
      this.world.invalidate();
    };
    const onReset = (): void => {
      view.reset();
      this.world.invalidate();
    };
    this.#document.on("change", onChange);
    this.#document.on("reset", onReset);
    this.#disposables.push(() => {
      this.#document.off("change", onChange);
      this.#document.off("reset", onReset);
    });
  }

  override destroy(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }

    super.destroy();
  }
}
