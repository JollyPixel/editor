// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  BlockShape,
  MaterialSurface,
  type BlockShapeJSON,
  type MaterialSurfaceJSON,
  type MirrorAxes
} from "@jolly-pixel/asset.voxel-model/client";
import { clampUvRegion } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

// Import Internal Dependencies
import {
  BlockBody,
  type BlockMesh
} from "./BlockBody.ts";
import { PivotMarker } from "./PivotMarker.ts";
import { RenderOrder } from "../renderOrder.ts";
import {
  paintBlockMaterial,
  paintBlockSurface
} from "./paintBlockSurface.ts";
import type { FlatShading } from "./FlatShading.ts";
import type { BlockShapeChanges } from "./BlockShapeMesh.ts";

// CONSTANTS
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

export class ModelBlock extends BlockBody {
  #surface: MaterialSurfaceJSON | null = null;
  #flat: FlatShading;
  #pivotMarker = new PivotMarker();
  #selectionTextureGhost: BlockMesh | null = null;

  constructor(
    options: ModelBlockOptions
  ) {
    super({
      shape: options.shape ?? BlockShape.box,
      flip: options.flip,
      size: options.size ?? new THREE.Vector3(1, 1, 1),
      texture: options.texture ?? null
    });
    const {
      position = new THREE.Vector3(0, 0, 0),
      pivotOffset = new THREE.Vector3(0, 0, 0),
      scale = new THREE.Vector3(1, 1, 1),
      rotation,
      name,
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

    this.mesh.name = name || `mesh_${this.node.uuid}`;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.#flat.shade(this.mesh.material);
    this.#paint();
    this.moveBoxAroundPivot(pivotOffset);

    this.node.add(this.#pivotMarker.object);
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
    clampUvRegion(this.mesh, texture);
    if (this.#selectionTextureGhost !== null) {
      clampUvRegion(this.#selectionTextureGhost, texture);
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

  override rebuild(
    changes: BlockShapeChanges
  ): boolean {
    if (!super.rebuild(changes)) {
      return false;
    }

    if (this.#selectionTextureGhost !== null) {
      this.#selectionTextureGhost.geometry = this.mesh.geometry;
    }

    return true;
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

  override dispose(): void {
    this.#disposeTextureGhost(this.#selectionTextureGhost);
    this.#pivotMarker.dispose();
    super.dispose();
  }

  #createTextureGhost(): BlockMesh {
    const ghost = new THREE.Mesh(
      this.mesh.geometry,
      new THREE.MeshStandardNodeMaterial({
        side: THREE.FrontSide,
        transparent: true,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false
      })
    );
    this.#flat.shade(ghost.material);
    this.#paintGhost(ghost);
    clampUvRegion(ghost, this.mesh.material.map);
    ghost.name = "selection-texture-ghost";
    ghost.renderOrder = RenderOrder.selectionGhost;
    this.mesh.add(ghost);

    return ghost;
  }

  #shownSurface(): MaterialSurfaceJSON {
    return this.#surface ?? MaterialSurface.create();
  }

  #paint(): void {
    paintBlockMaterial(this.mesh.material, this.#shownSurface());

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
