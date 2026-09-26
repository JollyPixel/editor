// Import Third-party Dependencies
import * as THREE from "three";
import type { BlockTransformJSON } from "@jolly-pixel/asset.voxel-model/client";
import type {
  TransformControls,
  TransformMode as ControlsMode,
  TransformOrientation
} from "@jolly-pixel/three";

// Import Internal Dependencies
import type { ModelBlock } from "../../../scene/blocks/index.ts";

// CONSTANTS
const kMinSize = 0.01;
const kSizeDecimals = 2;

export type TransformMode =
  | "pos"
  | "angle"
  | "size"
  | "pivot"
  | "scale";
export type GizmoSpace =
  | "world"
  | "local";

export interface GizmoTool {
  readonly controls: TransformControls;
  readonly mode: ControlsMode;
  orientation(space: GizmoSpace): TransformOrientation;
  attach(block: ModelBlock): THREE.Object3D;
  detach(): void;
  apply(block: ModelBlock, start: BlockTransformJSON): void;
  reset(): void;
}

export function nodeTool(
  controls: TransformControls,
  mode: ControlsMode,
  orientation: (space: GizmoSpace) => TransformOrientation = (space) => space
): GizmoTool {
  return {
    controls,
    mode,
    orientation,
    attach: (block) => block.node,
    detach: () => undefined,
    apply: () => undefined,
    reset: () => undefined
  };
}

export function resizeTool(
  controls: TransformControls
): GizmoTool {
  const handle = new THREE.Object3D();

  return {
    controls,
    mode: "scale",
    orientation: (space) => space,
    attach(block) {
      if (handle.parent !== block.mesh) {
        block.mesh.add(handle);
      }

      return handle;
    },
    detach() {
      handle.removeFromParent();
    },
    apply(block, start) {
      block.resize(new THREE.Vector3(
        sizeFrom(start.size.x, handle.scale.x),
        sizeFrom(start.size.y, handle.scale.y),
        sizeFrom(start.size.z, handle.scale.z)
      ));
    },
    reset() {
      handle.scale.set(1, 1, 1);
    }
  };
}

export function pivotTool(
  controls: TransformControls,
  scene: THREE.Object3D
): GizmoTool {
  const handle = new PivotHandle(controls);

  return {
    controls,
    mode: "translate",
    orientation: (space) => space,
    attach(block) {
      handle.block = block;
      if (handle.parent !== scene) {
        scene.add(handle);
      }
      handle.updateMatrixWorld(true);

      return handle;
    },
    detach() {
      handle.block = null;
      handle.removeFromParent();
    },
    apply(block, start) {
      const target = handle.getWorldPosition(new THREE.Vector3());
      block.transform = start;
      block.movePivotTo(target);
    },
    reset: () => undefined
  };
}

class PivotHandle extends THREE.Object3D {
  block: ModelBlock | null = null;

  #controls: TransformControls;

  constructor(
    controls: TransformControls
  ) {
    super();
    this.#controls = controls;
  }

  override updateMatrix(): void {
    if (this.block !== null && !this.#controls.dragging) {
      this.block.node.getWorldPosition(this.position);
      this.block.node.getWorldQuaternion(this.quaternion);
    }
    super.updateMatrix();
  }
}

function sizeFrom(
  start: number,
  factor: number
): number {
  const decimals = 10 ** kSizeDecimals;
  const size = Math.round(Math.abs(start * factor) * decimals) / decimals;

  return Math.max(kMinSize, size);
}
