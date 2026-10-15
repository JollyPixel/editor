// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  BlockShape,
  MaterialSurface,
  type BlockShapeJSON,
  type BlockTransformJSON,
  type MaterialSurfaceJSON,
  type MirrorAxes
} from "@jolly-pixel/asset.voxel-model/client";
import {
  clampUvRegion,
  type FaceRanges
} from "@jolly-pixel/editor.pixel-art/mesh-texturing";

// Import Internal Dependencies
import { BlockNode } from "./BlockNode.ts";
import { PivotMarker } from "./PivotMarker.ts";
import { RenderOrder } from "../renderOrder.ts";
import { plainVector3 } from "./plainVector3.ts";
import { paintBlockSurface } from "./paintBlockSurface.ts";
import type { FlatShading } from "./FlatShading.ts";
import {
  BlockShapeMesh,
  type BlockShapeChanges
} from "./BlockShapeMesh.ts";

// CONSTANTS
const kTransformRoundDecimals = 2;
const kDefaultEmphasisOwner = "default";
const kLocalPivotOwner = "local";
const kOccludedGhostOpacityScale = 0.35;
export const SELECTION_HIGHLIGHT_COLOR = 0xff00ff;

export interface ModelBlockOptions {
  uuid?: string;
  name?: string;
  position?: THREE.Vector3;
  pivotOffset?: THREE.Vector3;
  size?: THREE.Vector3;
  scale?: THREE.Vector3;
  rotation?: THREE.Euler;
  shape?: BlockShapeJSON;
  flip?: MirrorAxes;
  texture?: THREE.Texture | null;
  flatShading: FlatShading;
}

export type BlockMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardNodeMaterial>;

export class ModelBlock {
  readonly node = new BlockNode();
  readonly mesh: BlockMesh;

  #shapeMesh: BlockShapeMesh;
  #surface: MaterialSurfaceJSON | null = null;
  #flat: FlatShading;
  #pivotOffset = new THREE.Vector3();
  #pivotMarker = new PivotMarker();
  #selectionTextureGhost: BlockMesh | null = null;

  constructor(
    options: ModelBlockOptions
  ) {
    const {
      position = new THREE.Vector3(0, 0, 0),
      pivotOffset = new THREE.Vector3(0, 0, 0),
      size = new THREE.Vector3(1, 1, 1),
      scale = new THREE.Vector3(1, 1, 1),
      rotation,
      name,
      shape = BlockShape.box,
      flip,
      texture = null,
      uuid,
      flatShading
    } = options;
    this.#flat = flatShading;

    this.node.position.copy(position);
    this.node.scale.copy(scale);
    if (rotation !== undefined) {
      this.node.rotation.copy(rotation);
    }
    if (uuid !== undefined) {
      this.node.uuid = uuid;
    }
    this.node.name = name ?? "";

    this.#shapeMesh = new BlockShapeMesh({ shape, flip, size });
    this.mesh = new THREE.Mesh(
      this.#shapeMesh.geometry,
      new THREE.MeshStandardNodeMaterial({
        alphaTest: 0.01,
        side: THREE.DoubleSide,
        map: texture
      })
    );
    this.mesh.name = name || `mesh_${this.node.uuid}`;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.#flat.shade(this.mesh.material);
    clampUvRegion(this.mesh);
    this.#paint();
    this.moveBoxAroundPivot(pivotOffset);

    this.node.add(this.mesh, this.#pivotMarker.object);
  }

  get uuid(): string {
    return this.node.uuid;
  }

  get name(): string {
    return this.node.name;
  }

  set name(
    value: string
  ) {
    this.node.name = value;
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

  get visible(): boolean {
    return this.mesh.visible;
  }

  set visible(
    visible: boolean
  ) {
    this.mesh.visible = visible;
  }

  get texture(): THREE.Texture | null {
    return this.mesh.material.map;
  }

  set texture(
    texture: THREE.Texture | null
  ) {
    this.mesh.material.map = texture;
    this.mesh.material.needsUpdate = true;

    if (this.#selectionTextureGhost !== null) {
      this.#selectionTextureGhost.material.map = texture;
      this.#selectionTextureGhost.material.needsUpdate = true;
    }
  }

  get glows(): boolean {
    const { emissive, emissiveIntensity } = this.mesh.material;

    return emissiveIntensity > 0 && emissive.getHex() !== 0;
  }

  get surface(): MaterialSurfaceJSON | null {
    return this.#surface === null ? null : { ...this.#surface };
  }

  set surface(
    surface: MaterialSurfaceJSON | null
  ) {
    this.#surface = surface === null ? null : { ...surface };
    this.#paint();
  }

  get position(): THREE.Vector3 {
    return this.node.position.clone();
  }

  set position(
    position: THREE.Vector3
  ) {
    this.node.position.copy(position);
  }

  get worldPosition(): THREE.Vector3 {
    return this.node.getWorldPosition(new THREE.Vector3());
  }

  set worldPosition(
    position: THREE.Vector3
  ) {
    this.node.position.copy(
      this.node.parent ?
        this.node.parent.worldToLocal(position.clone()) :
        position
    );
  }

  get rotation(): THREE.Euler {
    return this.node.rotation.clone();
  }

  set rotation(
    rotation: THREE.Euler
  ) {
    this.node.rotation.copy(rotation);
  }

  get worldRotation(): THREE.Euler {
    const quaternion = this.node.getWorldQuaternion(
      new THREE.Quaternion()
    );

    return new THREE.Euler().setFromQuaternion(
      quaternion,
      this.node.rotation.order
    );
  }

  set worldRotation(
    rotation: THREE.Euler
  ) {
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    if (this.node.parent) {
      const parentQuaternion = this.node.parent.getWorldQuaternion(
        new THREE.Quaternion()
      );
      quaternion.premultiply(parentQuaternion.invert());
    }

    this.node.quaternion.copy(quaternion);
  }

  get scale(): THREE.Vector3 {
    return this.node.scale.clone();
  }

  set scale(
    scale: THREE.Vector3
  ) {
    this.node.scale.copy(scale);
  }

  get effectiveScale(): THREE.Vector3 {
    return new THREE.Vector3().copy(this.node.effectiveScale);
  }

  get pivotOffset(): THREE.Vector3 {
    return this.#pivotOffset.clone();
  }

  moveBoxAroundPivot(
    offset: THREE.Vector3
  ): void {
    this.#pivotOffset.copy(offset);
    this.#placeMesh();
  }

  movePivot(
    offset: THREE.Vector3
  ): void {
    const before = this.mesh.getWorldPosition(new THREE.Vector3());
    this.moveBoxAroundPivot(offset);
    const after = this.mesh.getWorldPosition(new THREE.Vector3());
    this.worldPosition = this.worldPosition.add(before.sub(after));
  }

  movePivotTo(
    world: THREE.Vector3
  ): void {
    const center = this.mesh.getWorldPosition(new THREE.Vector3());
    const toNodeSpace = this.node.matrixWorld
      .clone()
      .setPosition(0, 0, 0)
      .invert();

    this.movePivot(center.sub(world).applyMatrix4(toNodeSpace).negate());
  }

  get size(): THREE.Vector3 {
    return this.#shapeMesh.size;
  }

  get shape(): BlockShapeJSON {
    return this.#shapeMesh.shape;
  }

  get faces(): Readonly<FaceRanges> {
    return this.#shapeMesh.faces;
  }

  rebuild(
    changes: BlockShapeChanges
  ): boolean {
    if (!this.#shapeMesh.rebuild(changes)) {
      return false;
    }

    const { geometry } = this.#shapeMesh;
    this.mesh.geometry = geometry;
    clampUvRegion(this.mesh);
    if (this.#selectionTextureGhost !== null) {
      this.#selectionTextureGhost.geometry = geometry;
    }

    return true;
  }

  restoreBaseUv(): void {
    this.#shapeMesh.restoreBaseUv();
  }

  get transform(): BlockTransformJSON {
    return {
      position: plainVector3(this.node.position),
      pivotOffset: plainVector3(this.#pivotOffset),
      size: plainVector3(this.#shapeMesh.size),
      scale: plainVector3(this.node.scale),
      rotation: plainVector3(this.node.rotation)
    };
  }

  set transform(
    transform: BlockTransformJSON
  ) {
    const { rotation } = transform;

    this.position = new THREE.Vector3().copy(transform.position);
    this.moveBoxAroundPivot(new THREE.Vector3().copy(transform.pivotOffset));
    this.rotation = new THREE.Euler(rotation.x, rotation.y, rotation.z);
    this.scale = new THREE.Vector3().copy(transform.scale);
    this.resize(new THREE.Vector3().copy(transform.size));
  }

  showSelectionGhost(): void {
    if (this.#selectionTextureGhost !== null) {
      return;
    }
    this.#selectionTextureGhost = this.#createTextureGhost();
  }

  hideSelectionGhost(): void {
    this.#disposeTextureGhost(this.#selectionTextureGhost);
    this.#selectionTextureGhost = null;
  }

  emphasize(
    color: THREE.ColorRepresentation,
    owner: string = kDefaultEmphasisOwner
  ): void {
    this.#pivotMarker.show(owner, color);
  }

  clearEmphasis(
    owner: string = kDefaultEmphasisOwner
  ): void {
    this.#pivotMarker.hide(owner);
  }

  roundTransform(
    decimals: number = kTransformRoundDecimals
  ): void {
    roundVector(this.node.position, decimals);
    roundVector(this.#pivotOffset, decimals);
    this.node.rotation.set(
      roundAngle(this.node.rotation.x, decimals),
      roundAngle(this.node.rotation.y, decimals),
      roundAngle(this.node.rotation.z, decimals)
    );
    roundVector(this.node.scale, decimals);

    this.#placeMesh();
  }

  resize(
    size: THREE.Vector3
  ): void {
    if (!sameRounded(this.#shapeMesh.size, size, kTransformRoundDecimals)) {
      this.#shapeMesh.resize(size);
    }
  }

  dispose(): void {
    this.#shapeMesh.dispose();
    this.mesh.material.dispose();
    this.#disposeTextureGhost(this.#selectionTextureGhost);
    this.#pivotMarker.dispose();
    this.node.removeFromParent();
  }

  #placeMesh(): void {
    this.mesh.position.copy(this.#pivotOffset).negate();
  }

  #createTextureGhost(): BlockMesh {
    const ghost = new THREE.Mesh(
      this.mesh.geometry,
      new THREE.MeshStandardNodeMaterial({
        map: this.mesh.material.map,
        side: THREE.FrontSide,
        transparent: true,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false
      })
    );
    this.#flat.shade(ghost.material);
    this.#paintGhost(ghost);
    clampUvRegion(ghost);
    ghost.name = "selection-texture-ghost";
    ghost.renderOrder = RenderOrder.selectionGhost;
    this.mesh.add(ghost);

    return ghost;
  }

  #shownSurface(): MaterialSurfaceJSON {
    return this.#surface ?? MaterialSurface.create();
  }

  #paint(): void {
    const surface = this.#shownSurface();
    const target = this.mesh.material;
    const transparent = surface.opacity < 1;
    if (target.transparent !== transparent) {
      target.transparent = transparent;
      target.depthWrite = !transparent;
      target.needsUpdate = true;
    }
    paintBlockSurface(target, surface);

    const ghost = this.#selectionTextureGhost;
    if (ghost !== null) {
      this.#paintGhost(ghost);
    }
  }

  #paintGhost(
    ghost: BlockMesh
  ): void {
    const surface = this.#shownSurface();
    paintBlockSurface(ghost.material, surface);
    ghost.material.opacity = surface.opacity * kOccludedGhostOpacityScale;
  }

  #disposeTextureGhost(
    ghost: BlockMesh | null
  ): void {
    if (ghost === null) {
      return;
    }

    this.mesh.remove(ghost);
    ghost.material.dispose();
  }
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
