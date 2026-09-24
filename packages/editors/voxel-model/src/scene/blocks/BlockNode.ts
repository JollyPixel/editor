// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kUnitScale = new THREE.Vector3(1, 1, 1);
const kOrigin = new THREE.Vector3();
const kAnchorInverse = new THREE.Matrix4();
const kFrame = new THREE.Matrix4();

export class BlockNode extends THREE.Group {
  #effectiveScale = new THREE.Vector3(1, 1, 1);

  static anchorScaleOf(
    parent: THREE.Object3D | null
  ): Readonly<THREE.Vector3Like> {
    return parent instanceof BlockNode ? parent.effectiveScale : kUnitScale;
  }

  override updateMatrix(): void {
    const anchor = BlockNode.anchorScaleOf(this.parent);
    this.#effectiveScale.copy(anchor).multiply(this.scale);

    kAnchorInverse.makeScale(inverseOrOne(anchor.x), inverseOrOne(anchor.y), inverseOrOne(anchor.z));
    kFrame.compose(kOrigin, this.quaternion, this.#effectiveScale);
    this.matrix
      .makeTranslation(this.position)
      .multiply(kAnchorInverse)
      .multiply(kFrame);
    this.matrixWorldNeedsUpdate = true;
  }

  get effectiveScale(): Readonly<THREE.Vector3Like> {
    return this.#effectiveScale;
  }
}

function inverseOrOne(
  value: number
): number {
  return value === 0 ? 1 : 1 / value;
}
