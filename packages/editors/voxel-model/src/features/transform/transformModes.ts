// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { ModelBlock } from "../../scene/index.ts";
import type { TransformMode } from "./gizmo/gizmoTools.ts";

export interface TransformModeSpec {
  readonly label: string;
  readonly icon: string;
  readonly spaces: boolean;
  readonly showsPivot: boolean;
  read(block: ModelBlock, world: boolean): THREE.Vector3Like;
  write(block: ModelBlock, value: THREE.Vector3, world: boolean): void;
}

export const TRANSFORM_MODES: Readonly<Record<TransformMode, TransformModeSpec>> = {
  pos: {
    label: "Pos",
    icon: "transform-position",
    spaces: true,
    showsPivot: true,
    read: (block, world) => (world ? block.worldPosition : block.position),
    write(block, value, world) {
      if (world) {
        block.worldPosition = value;
      }
      else {
        block.position = value;
      }
    }
  },
  angle: {
    label: "Angle",
    icon: "transform-angle",
    spaces: true,
    showsPivot: true,
    read(block, world) {
      const rotation = world ? block.worldRotation : block.rotation;

      return {
        x: THREE.MathUtils.radToDeg(rotation.x),
        y: THREE.MathUtils.radToDeg(rotation.y),
        z: THREE.MathUtils.radToDeg(rotation.z)
      };
    },
    write(block, value, world) {
      const rotation = new THREE.Euler(
        THREE.MathUtils.degToRad(value.x),
        THREE.MathUtils.degToRad(value.y),
        THREE.MathUtils.degToRad(value.z)
      );
      if (world) {
        block.worldRotation = rotation;
      }
      else {
        block.rotation = rotation;
      }
    }
  },
  size: {
    label: "Size",
    icon: "transform-size",
    spaces: false,
    showsPivot: true,
    read: (block) => block.size,
    write: (block, value) => block.resize(value)
  },
  pivot: {
    label: "Pivot",
    icon: "transform-pivot",
    spaces: true,
    showsPivot: true,
    read: (block, world) => (world ? block.worldPosition : block.pivotOffset),
    write(block, value, world) {
      if (world) {
        block.movePivotTo(value);
      }
      else {
        block.movePivot(value);
      }
    }
  },
  scale: {
    label: "Scale",
    icon: "transform-scale",
    spaces: false,
    showsPivot: false,
    read: (block) => block.scale,
    write(block, value) {
      block.scale = value;
    }
  }
};
