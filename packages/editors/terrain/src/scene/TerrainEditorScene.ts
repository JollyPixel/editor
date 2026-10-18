// Import Third-party Dependencies
import {
  OrbitFlyCamera,
  Systems
} from "@jolly-pixel/engine";
import { Grid } from "@jolly-pixel/three";
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

export class TerrainEditorScene extends Systems.Scene {
  constructor() {
    super("terrain-editor");
  }

  override awake(): void {
    this.world.sceneManager.getSource().add(
      new Grid({
        extent: CHUNK_SAMPLES * 4,
        cell: {
          color: "#3a3a3a",
          thickness: 1
        },
        section: {
          show: true
        },
        fade: {
          from: "origin",
          distance: CHUNK_SAMPLES * 4
        },
        axes: {
          show: true
        }
      })
    );

    this.world
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
  }
}
