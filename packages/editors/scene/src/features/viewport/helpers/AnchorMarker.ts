// Import Third-party Dependencies
import * as THREE from "three";
import type { Systems } from "@jolly-pixel/engine";

// CONSTANTS
const kSize = 0.15;
const kAxisLength = 0.35;
const kRenderOrder = 999;
const kLocal = new THREE.Matrix4();
const kWorld = new THREE.Matrix4();
const kPosition = new THREE.Vector3();
const kRotation = new THREE.Euler();
const kQuaternion = new THREE.Quaternion();
const kScale = new THREE.Vector3();
const kUnitScale = new THREE.Vector3(1, 1, 1);

export class AnchorMarker {
  readonly root = new THREE.Group();

  #shape: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  #axes = new THREE.AxesHelper(kAxisLength);

  constructor(
    color: THREE.ColorRepresentation
  ) {
    this.#shape = new THREE.Mesh(
      new THREE.OctahedronGeometry(kSize),
      new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        depthTest: false,
        transparent: true
      })
    );
    const axesMaterial = this.#axes.material;
    if (!Array.isArray(axesMaterial)) {
      axesMaterial.depthTest = false;
      axesMaterial.transparent = true;
    }
    this.#shape.renderOrder = kRenderOrder;
    this.#axes.renderOrder = kRenderOrder;
    this.root.add(this.#shape, this.#axes);
  }

  place(
    ownerWorld: THREE.Matrix4,
    pose: Systems.ComponentAnchorPose
  ): void {
    kRotation.set(
      THREE.MathUtils.degToRad(pose.rotation.x),
      THREE.MathUtils.degToRad(pose.rotation.y),
      THREE.MathUtils.degToRad(pose.rotation.z)
    );
    kLocal.compose(
      kPosition.set(pose.position.x, pose.position.y, pose.position.z),
      kQuaternion.setFromEuler(kRotation),
      kUnitScale
    );
    kWorld
      .multiplyMatrices(ownerWorld, kLocal)
      .decompose(this.root.position, this.root.quaternion, kScale);
  }

  dispose(): void {
    this.#shape.geometry.dispose();
    this.#shape.material.dispose();
    this.#axes.dispose();
  }
}
