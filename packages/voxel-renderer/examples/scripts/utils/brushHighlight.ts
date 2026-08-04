// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  VoxelCoord
} from "../../../src/world/types.ts";

// CONSTANTS
/** The local brush is always white; peer colors come from `peerColor()`. */
export const LOCAL_BRUSH_COLOR = "#ffffff";

// Slightly larger than a voxel so the outline never z-fights with the faces it wraps.
const kEdgesGeometry = new THREE.EdgesGeometry(
  new THREE.BoxGeometry(1.02, 1.02, 1.02)
);
const kFillGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);

export interface HighlightBoxOptions {
  /**
   * Adds a translucent body inside the outline.
   * @default false
   */
  fill?: boolean;
}

export function createHighlightBox(
  color: THREE.ColorRepresentation,
  options: HighlightBoxOptions = {}
): THREE.Group {
  const { fill = false } = options;

  const group = new THREE.Group();
  group.name = "brush_highlight";
  group.visible = false;
  group.add(new THREE.LineSegments(
    kEdgesGeometry,
    new THREE.LineBasicMaterial({ color, depthTest: false })
  ));

  if (fill) {
    group.add(new THREE.Mesh(
      kFillGeometry,
      new THREE.MeshBasicMaterial({
        color,
        opacity: 0.15,
        transparent: true,
        depthWrite: false
      })
    ));
  }

  // Drawn after the chunk meshes so the outline stays readable through them.
  group.renderOrder = 1;

  return group;
}

export function moveHighlight(
  highlight: THREE.Object3D,
  position: VoxelCoord | null
): void {
  if (position === null) {
    highlight.visible = false;

    return;
  }

  highlight.position.set(
    position.x + 0.5,
    position.y + 0.5,
    position.z + 0.5
  );
  highlight.visible = true;
}
