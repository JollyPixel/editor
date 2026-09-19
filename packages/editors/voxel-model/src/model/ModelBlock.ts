// Import Third-party Dependencies
import * as THREE from "three";
import type { GroupTransformJSON } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  PivotMarker,
  NEUTRAL_HIGHLIGHT_COLOR
} from "./PivotMarker.ts";
import {
  toEuler,
  toVector3,
  toVector3JSON
} from "./transformCodec.ts";

// CONSTANTS
const kSelectionScale = 1.06;
const kSelectionOpacity = 0.6;
const kTransformRoundDecimals = 2;
const kEmphasisScale = 1.12;
const kEmphasisOpacity = 0.85;
const kDefaultEmphasisOwner = "default";
const kLocalPivotOwner = "local";

export interface ModelBlockOptions {
  uuid?: string;
  name?: string;
  position?: THREE.Vector3;
  pivotOffset?: THREE.Vector3;
  size?: THREE.Vector3;
  scale?: THREE.Vector3;
  rotation?: THREE.Euler;
  color?: THREE.ColorRepresentation;
  texture?: THREE.Texture | null;
}

type BlockMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

export class ModelBlock {
  readonly root = new THREE.Group();
  readonly pivot = new THREE.Group();
  readonly mesh: BlockMesh;

  #size: THREE.Vector3;
  #pivotMarker = new PivotMarker();
  #selectionShell: BlockMesh | null = null;
  #emphasisShell: BlockMesh | null = null;
  #emphasisOwners = new Map<string, THREE.ColorRepresentation>();

  constructor(
    options: ModelBlockOptions = {}
  ) {
    const {
      position = new THREE.Vector3(0, 0, 0),
      pivotOffset = new THREE.Vector3(0, 0, 0),
      size = new THREE.Vector3(1, 1, 1),
      scale = new THREE.Vector3(1, 1, 1),
      rotation,
      color = 0xffffff,
      name,
      texture = null,
      uuid
    } = options;

    this.root.position.copy(position);
    if (uuid !== undefined) {
      this.root.uuid = uuid;
    }

    this.pivot.position.copy(pivotOffset);
    if (rotation !== undefined) {
      this.pivot.rotation.copy(rotation);
    }
    this.root.add(this.pivot);

    this.#size = size.clone();
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        alphaTest: 0.01,
        side: THREE.DoubleSide,
        map: texture
      })
    );
    this.mesh.position.copy(pivotOffset).negate();
    this.mesh.scale.copy(scale);
    this.mesh.name = name || `mesh_${this.root.uuid}`;
    this.root.name = name ?? "";

    this.pivot.add(this.mesh);
    this.pivot.add(this.#pivotMarker.object);
  }

  get uuid(): string {
    return this.root.uuid;
  }

  get name(): string {
    return this.root.name;
  }

  set name(
    value: string
  ) {
    this.root.name = value;
  }

  get selected(): boolean {
    return this.#selectionShell !== null;
  }

  set selected(
    value: boolean
  ) {
    if (value === this.selected) {
      return;
    }

    if (value) {
      this.#selectionShell = this.#createGlowShell(
        NEUTRAL_HIGHLIGHT_COLOR,
        kSelectionOpacity,
        kSelectionScale,
        "selection-shell"
      );

      return;
    }

    this.#disposeShell(this.#selectionShell);
    this.#selectionShell = null;
  }

  get pivotMarkerVisible(): boolean {
    return this.#pivotMarker.isShownBy(kLocalPivotOwner);
  }

  set pivotMarkerVisible(
    visible: boolean
  ) {
    if (visible) {
      this.#pivotMarker.show(kLocalPivotOwner);
    }
    else {
      this.#pivotMarker.hide(kLocalPivotOwner);
    }
  }

  get texture(): THREE.Texture | null {
    return this.mesh.material.map;
  }

  set texture(
    texture: THREE.Texture | null
  ) {
    this.mesh.material.map = texture;
    this.mesh.material.needsUpdate = true;
  }

  get position(): THREE.Vector3 {
    return this.root.position.clone();
  }

  set position(
    position: THREE.Vector3
  ) {
    this.root.position.copy(position);
  }

  get worldPosition(): THREE.Vector3 {
    return this.root.getWorldPosition(new THREE.Vector3());
  }

  set worldPosition(
    position: THREE.Vector3
  ) {
    this.root.position.copy(toParentSpace(this.root, position));
  }

  get rotation(): THREE.Euler {
    return this.pivot.rotation.clone();
  }

  set rotation(
    rotation: THREE.Euler
  ) {
    this.pivot.rotation.copy(rotation);
  }

  get worldRotation(): THREE.Euler {
    const quaternion = this.pivot.getWorldQuaternion(new THREE.Quaternion());

    return new THREE.Euler().setFromQuaternion(quaternion, this.pivot.rotation.order);
  }

  set worldRotation(
    rotation: THREE.Euler
  ) {
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    if (this.pivot.parent) {
      const parentQuaternion = this.pivot.parent.getWorldQuaternion(new THREE.Quaternion());
      quaternion.premultiply(parentQuaternion.invert());
    }

    this.pivot.quaternion.copy(quaternion);
  }

  get scale(): THREE.Vector3 {
    return this.mesh.scale.clone();
  }

  set scale(
    scale: THREE.Vector3
  ) {
    this.mesh.scale.copy(scale);
  }

  get pivotOffset(): THREE.Vector3 {
    return this.pivot.position.clone();
  }

  set pivotOffset(
    offset: THREE.Vector3
  ) {
    this.pivot.position.copy(offset);
    this.syncMeshToPivot();
  }

  get worldPivotOffset(): THREE.Vector3 {
    return this.pivot.getWorldPosition(new THREE.Vector3());
  }

  set worldPivotOffset(
    offset: THREE.Vector3
  ) {
    this.pivotOffset = toParentSpace(this.pivot, offset);
  }

  get size(): THREE.Vector3 {
    return this.#size.clone();
  }

  get transform(): GroupTransformJSON {
    return {
      position: toVector3JSON(this.root.position),
      pivotOffset: toVector3JSON(this.pivot.position),
      size: toVector3JSON(this.#size),
      scale: toVector3JSON(this.mesh.scale),
      rotation: toVector3JSON(this.pivot.rotation)
    };
  }

  set transform(
    transform: GroupTransformJSON
  ) {
    this.position = toVector3(transform.position);
    this.pivotOffset = toVector3(transform.pivotOffset);
    this.rotation = toEuler(transform.rotation);
    this.scale = toVector3(transform.scale);
    this.resize(toVector3(transform.size));
  }

  emphasize(
    color: THREE.ColorRepresentation,
    owner: string = kDefaultEmphasisOwner
  ): void {
    this.#emphasisOwners.set(owner, color);
    this.#pivotMarker.show(owner, color);
    this.#applyShellColor(color);
  }

  clearEmphasis(
    owner: string = kDefaultEmphasisOwner
  ): void {
    this.#emphasisOwners.delete(owner);
    this.#pivotMarker.hide(owner);

    const remaining = [...this.#emphasisOwners.values()].at(-1);
    if (remaining !== undefined) {
      this.#applyShellColor(remaining);

      return;
    }

    this.#disposeShell(this.#emphasisShell);
    this.#emphasisShell = null;
  }

  syncMeshToPivot(): void {
    this.mesh.position.copy(this.pivot.position).negate();
  }

  roundTransform(
    decimals: number = kTransformRoundDecimals
  ): void {
    roundVector(this.root.position, decimals);
    roundVector(this.pivot.position, decimals);
    this.pivot.rotation.set(
      roundAngle(this.pivot.rotation.x, decimals),
      roundAngle(this.pivot.rotation.y, decimals),
      roundAngle(this.pivot.rotation.z, decimals)
    );
    roundVector(this.mesh.scale, decimals);

    this.syncMeshToPivot();
  }

  resize(
    size: THREE.Vector3
  ): void {
    if (sameRounded(this.#size, size, kTransformRoundDecimals)) {
      return;
    }

    const next = new THREE.BoxGeometry(size.x, size.y, size.z);
    const target = this.mesh.geometry.getAttribute("position");
    const source = next.getAttribute("position");
    for (let index = 0; index < target.count; index++) {
      target.setXYZ(
        index,
        source.getX(index),
        source.getY(index),
        source.getZ(index)
      );
    }
    target.needsUpdate = true;
    next.dispose();

    this.mesh.geometry.computeBoundingBox();
    this.mesh.geometry.computeBoundingSphere();
    this.#size.copy(size);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.#disposeShell(this.#selectionShell);
    this.#disposeShell(this.#emphasisShell);
    this.#pivotMarker.dispose();
    this.root.removeFromParent();
  }

  #applyShellColor(
    color: THREE.ColorRepresentation
  ): void {
    if (this.#emphasisShell === null) {
      this.#emphasisShell = this.#createGlowShell(
        color,
        kEmphasisOpacity,
        kEmphasisScale,
        "emphasis-shell"
      );

      return;
    }

    this.#emphasisShell.material.color.set(color);
  }

  #createGlowShell(
    color: THREE.ColorRepresentation,
    opacity: number,
    scale: number,
    name: string
  ): BlockMesh {
    const shell = new THREE.Mesh(
      this.mesh.geometry,
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.BackSide,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    shell.name = name;
    shell.scale.setScalar(scale);
    this.mesh.add(shell);

    return shell;
  }

  #disposeShell(
    shell: BlockMesh | null
  ): void {
    if (shell === null) {
      return;
    }

    this.mesh.remove(shell);
    shell.material.dispose();
  }
}

function toParentSpace(
  object: THREE.Object3D,
  worldPoint: THREE.Vector3
): THREE.Vector3 {
  return object.parent ?
    object.parent.worldToLocal(worldPoint.clone()) :
    worldPoint.clone();
}

function roundTo(
  value: number,
  decimals: number
): number {
  return Number(value.toFixed(decimals));
}

function roundVector(
  vector: THREE.Vector3,
  decimals: number
): void {
  vector.set(
    roundTo(vector.x, decimals),
    roundTo(vector.y, decimals),
    roundTo(vector.z, decimals)
  );
}

function roundAngle(
  radians: number,
  decimals: number
): number {
  return THREE.MathUtils.degToRad(
    roundTo(THREE.MathUtils.radToDeg(radians), decimals)
  );
}

function sameRounded(
  left: THREE.Vector3,
  right: THREE.Vector3,
  decimals: number
): boolean {
  return roundTo(left.x, decimals) === roundTo(right.x, decimals) &&
    roundTo(left.y, decimals) === roundTo(right.y, decimals) &&
    roundTo(left.z, decimals) === roundTo(right.z, decimals);
}
