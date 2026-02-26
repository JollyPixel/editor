// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  VoxelRenderer,
  VoxelRotation
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";
import { VoxelBrushPreview } from "./VoxelBrushPreview.ts";

type VoxelRotationType = typeof VoxelRotation[
  keyof typeof VoxelRotation
];

export interface VoxelBrushOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
  /**
   * @default 4096
   */
  groundPlaneSize?: number;
}

/**
 * Handles voxel painting / erasing
 */
export class VoxelBrush extends ActorComponent {
  readonly vr: VoxelRenderer;

  #camera: THREE.PerspectiveCamera;
  #raycaster = new THREE.Raycaster();
  #plane: THREE.Mesh;
  #preview: VoxelBrushPreview;

  constructor(
    actor: Actor,
    options: VoxelBrushOptions
  ) {
    super({
      actor,
      typeName: "VoxelBrush"
    });
    const {
      vr,
      camera,
      groundPlaneSize = 4096
    } = options;

    this.vr = vr;
    this.#camera = camera;

    // Invisible ground plane for hit-testing when no voxels exist yet.
    this.#plane = new THREE.Mesh(
      new THREE.PlaneGeometry(
        groundPlaneSize,
        groundPlaneSize
      ).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide
      })
    );
    this.#plane.name = "voxel_brush_plane";

    this.actor.addChildren(this.#plane);
    this.#preview = this.actor.addComponentAndGet(VoxelBrushPreview);
  }

  update() {
    const { input } = this.actor.world;
    const isCtrl = input.isKeyDown("ControlLeft") || input.isKeyDown("ControlRight");

    // No brush interaction when an object layer is selected.
    if (
      editorState.selectedLayerType === "object"
    ) {
      this.#preview.hide();

      return;
    }

    if (isCtrl) {
      if (input.isMouseButtonDown("scrollUp")) {
        editorState.setBrushSize(1);
      }
      if (input.isMouseButtonDown("scrollDown")) {
        editorState.setBrushSize(-1);
      }

      this.#updatePreview();

      return;
    }

    if (!editorState.isGizmoDragging) {
      if (input.wasMouseButtonJustPressed("left")) {
        if (editorState.selectedLayer) {
          this.#placeVoxels();
        }
      }
      else if (input.wasMouseButtonJustPressed("right")) {
        if (editorState.selectedLayer) {
          this.#removeVoxels();
        }
      }
    }

    this.#updatePreview();
  }

  #castRay(): THREE.Intersection | null {
    const { input } = this.actor.world;
    const scene = this.actor.world.sceneManager.getSource();

    this.#raycaster.setFromCamera(
      input.getMousePosition(),
      this.#camera
    );

    const voxelHits = this.#raycaster.intersectObjects(
      scene.children,
      true
    ).filter((intersection) => intersection.object.name.startsWith("voxel_chunk_"));

    if (voxelHits.length > 0) {
      return voxelHits[0];
    }

    const planeHits = this.#raycaster.intersectObject(
      this.#plane,
      false
    );

    return planeHits.length > 0 ? planeHits[0] : null;
  }

  #hitToVoxelPos(
    hit: THREE.Intersection,
    place: boolean
  ): THREE.Vector3 {
    const point = hit.point.clone();
    if (hit.face && place) {
      point.addScaledVector(hit.face.normal, 0.5);
    }
    else if (hit.face && !place) {
      point.addScaledVector(hit.face.normal, -0.5);
    }

    return new THREE.Vector3(
      Math.floor(point.x),
      Math.floor(point.y),
      Math.floor(point.z)
    );
  }

  #getBrushPositions(
    center: THREE.Vector3
  ): THREE.Vector3[] {
    const size = editorState.brushSize;
    const half = Math.floor(size / 2);
    const positions: THREE.Vector3[] = [];

    for (let dx = 0; dx < size; dx++) {
      for (let dz = 0; dz < size; dz++) {
        positions.push(new THREE.Vector3(
          center.x - half + dx,
          center.y,
          center.z - half + dz
        ));
      }
    }

    return positions;
  }

  /**
   * Aligns the block's front face toward the dominant camera viewing direction.
   * Maps the XZ look direction to one of 4 VoxelRotation values.
   */
  #resolveRotation(): VoxelRotationType {
    const mode = editorState.rotationMode;
    if (mode !== "auto") {
      return mode;
    }

    const dir = new THREE.Vector3();
    this.#camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const absX = Math.abs(dir.x);
    const absZ = Math.abs(dir.z);

    if (absZ >= absX) {
      // Dominant Z axis
      return dir.z > 0 ?
        VoxelRotation.None :
        VoxelRotation.Deg180;
    }

    // Dominant X axis
    return dir.x > 0 ?
      VoxelRotation.CCW90 :
      VoxelRotation.CW90;
  }

  #placeVoxels(): void {
    const hit = this.#castRay();
    if (!hit) {
      return;
    }

    const center = this.#hitToVoxelPos(hit, true);
    const rotation = this.#resolveRotation();
    const layerName = editorState.selectedLayer!;

    for (const pos of this.#getBrushPositions(center)) {
      this.vr.setVoxel(layerName, {
        position: pos,
        blockId: editorState.selectedBlockId,
        rotation
      });
    }
  }

  #removeVoxels(): void {
    const hit = this.#castRay();
    if (!hit) {
      return;
    }

    const center = this.#hitToVoxelPos(hit, false);
    const layerName = editorState.selectedLayer!;

    for (const pos of this.#getBrushPositions(center)) {
      this.vr.removeVoxel(layerName, { position: pos });
    }
  }

  #updatePreview(): void {
    if (editorState.isGizmoDragging) {
      this.#preview.hide();

      return;
    }

    const hit = this.#castRay();
    if (hit) {
      const center = this.#hitToVoxelPos(hit, true);
      this.#preview.updateFromPositions(
        this.#getBrushPositions(center)
      );
    }
    else {
      this.#preview.count = 0;
    }
  }
}
