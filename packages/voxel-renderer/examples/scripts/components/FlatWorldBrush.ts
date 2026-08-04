// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { VoxelEngine } from "../../../src/VoxelEngine.ts";
import type { VoxelCoord } from "../../../src/world/types.ts";
import {
  createHighlightBox,
  moveHighlight,
  LOCAL_BRUSH_COLOR
} from "../utils/brushHighlight.ts";
import {
  FLOOR_SIZE,
  GROUND_LAYER,
  PLACED_BLOCK_ID
} from "../utils/flatWorld.ts";
import { coordEqual } from "../utils/presence.ts";

export interface FlatWorldBrushOptions {
  engine: VoxelEngine;
  camera: THREE.PerspectiveCamera;
}

/**
 * A 1×1×1 brush: left click places a voxel against the face under the cursor,
 * right click removes the voxel that face belongs to.
 */
export class FlatWorldBrush extends ActorComponent {
  /** Fired when the highlighted cell changes, `null` when nothing is aimed at. */
  onBrushMoved?: (position: VoxelCoord | null) => void;

  #engine: VoxelEngine;
  #camera: THREE.PerspectiveCamera;
  #raycaster = new THREE.Raycaster();
  #plane: THREE.Mesh;
  #highlight: THREE.Group;
  #position: VoxelCoord | null = null;

  constructor(
    actor: Actor,
    options: FlatWorldBrushOptions
  ) {
    super({
      actor,
      typeName: "FlatWorldBrush"
    });

    this.#engine = options.engine;
    this.#camera = options.camera;

    // Catches clicks aimed at a hole punched through the floor, so a cell can
    // always be built back.
    this.#plane = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE)
        .rotateX(-Math.PI / 2)
        .translate(FLOOR_SIZE / 2, 0, FLOOR_SIZE / 2),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    this.#plane.name = "flat_world_ground_plane";

    this.#highlight = createHighlightBox(LOCAL_BRUSH_COLOR, { fill: true });
    this.actor.addChildren(this.#plane, this.#highlight);
  }

  update(): void {
    const hit = this.#castRay();
    if (hit === null) {
      this.#setPosition(null);

      return;
    }

    const target = FlatWorldBrush.#hitToVoxelPos(hit, true);
    this.#setPosition(target);

    const { input } = this.actor.world;
    if (input.wasMouseButtonJustPressed("left")) {
      this.#engine.setVoxel(GROUND_LAYER, {
        position: target,
        blockId: PLACED_BLOCK_ID
      });
    }
    // Only a chunk hit has a voxel behind it; the ground plane has none.
    else if (
      input.wasMouseButtonJustPressed("right") &&
      hit.object !== this.#plane
    ) {
      this.#engine.removeVoxel(GROUND_LAYER, {
        position: FlatWorldBrush.#hitToVoxelPos(hit, false)
      });
    }
  }

  #setPosition(
    position: VoxelCoord | null
  ): void {
    moveHighlight(this.#highlight, position);

    if (coordEqual(position, this.#position)) {
      return;
    }

    this.#position = position;
    this.onBrushMoved?.(position);
  }

  #castRay(): THREE.Intersection | null {
    const { input } = this.actor.world;
    const scene = this.actor.world.sceneManager.getSource();

    this.#raycaster.setFromCamera(
      input.getMousePosition(),
      this.#camera
    );

    const voxelHits = this.#raycaster
      .intersectObjects(scene.children, true)
      .filter((intersection) => intersection.object.name.startsWith("voxel_chunk_"));
    if (voxelHits.length > 0) {
      return voxelHits[0];
    }

    const planeHits = this.#raycaster.intersectObject(this.#plane, false);

    return planeHits.length > 0 ? planeHits[0] : null;
  }

  static #hitToVoxelPos(
    hit: THREE.Intersection,
    place: boolean
  ): VoxelCoord {
    const point = hit.point.clone();
    if (hit.face) {
      point.addScaledVector(hit.face.normal, place ? 0.5 : -0.5);
    }

    return {
      x: Math.floor(point.x),
      y: Math.floor(point.y),
      z: Math.floor(point.z)
    };
  }
}
