// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import PivotMarker from "./PivotMarker.ts";

// CONSTANTS
const kEdgeDefaultColor = 0x000000;
const kEdgeSelectedColor = 0xff00ff;
const kTransformRoundDecimals = 2;

function roundTo(
  value: number,
  decimals: number
): number {
  return Number(value.toFixed(decimals));
}

export interface GroupManagerOptions {
  pos?: THREE.Vector3;
  pivotPos?: THREE.Vector3;
  size?: THREE.Vector3;
  scale?: THREE.Vector3;
  color?: THREE.Color;
  name?: string;
  texture?: THREE.Texture | null;
}

export default class GroupManager {
  private group: THREE.Group;
  private pivot: THREE.Group;
  private mesh: THREE.Mesh;
  private pivotMarker: PivotMarker;
  private edges: THREE.LineSegments;
  private isSelected: boolean = false;

  constructor(options: GroupManagerOptions = {}) {
    const {
      pos = new THREE.Vector3(0, 0, 0),
      pivotPos = new THREE.Vector3(0, 0, 0),
      size = new THREE.Vector3(1, 1, 1),
      scale = new THREE.Vector3(1, 1, 1),
      color = new THREE.Color(0xffffff),
      name,
      texture = null
    } = options;

    this.group = new THREE.Group();
    this.group.position.copy(pos);

    this.pivot = new THREE.Group();
    this.pivot.position.copy(pivotPos);
    this.group.add(this.pivot);

    const geometry = new THREE.BoxGeometry(...size);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.DoubleSide,
      map: texture
    });
    material.needsUpdate = true;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(pivotPos).negate();
    this.mesh.scale.x = scale.x;
    this.mesh.scale.y = scale.y;
    this.mesh.scale.z = scale.z;
    const meshName = name || `mesh_${this.group.uuid}`;
    this.mesh.name = meshName;
    this.group.name = name ?? "";

    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: kEdgeDefaultColor });
    this.edges = new THREE.LineSegments(edgesGeo, edgesMat);
    this.edges.name = "edges";
    this.mesh.add(this.edges);

    this.pivot.add(this.mesh);

    this.pivotMarker = new PivotMarker();
    this.pivot.add(this.pivotMarker.object);
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  public getPivot(): THREE.Group {
    return this.pivot;
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public select(): void {
    if (this.isSelected) {
      return;
    }

    this.isSelected = true;

    if (this.edges.material instanceof THREE.LineBasicMaterial) {
      this.edges.material.color.set(kEdgeSelectedColor);
    }
  }

  public deselect(): void {
    if (!this.isSelected) {
      return;
    }

    this.isSelected = false;

    if (this.edges.material instanceof THREE.LineBasicMaterial) {
      this.edges.material.color.set(kEdgeDefaultColor);
    }
  }

  public isSelectedState(): boolean {
    return this.isSelected;
  }

  public setPivotMarkerVisible(visible: boolean): void {
    this.pivotMarker.setVisible(visible);
  }

  public setTexture(texture: THREE.Texture | null): void {
    if (this.mesh.material instanceof THREE.MeshBasicMaterial) {
      this.mesh.material.map = texture;
      this.mesh.material.needsUpdate = true;
    }
  }

  public getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  public setPosition(position: THREE.Vector3): void {
    this.group.position.copy(position);
  }

  public getPositionWorld(): THREE.Vector3 {
    return this.group.getWorldPosition(new THREE.Vector3());
  }

  public setPositionWorld(position: THREE.Vector3): void {
    const local = this.group.parent
      ? this.group.parent.worldToLocal(position.clone())
      : position.clone();
    this.group.position.copy(local);
  }

  public get name(): string {
    return this.group.name;
  }

  public set name(value: string) {
    this.group.name = value;
  }

  public getRotation(): THREE.Euler {
    return this.pivot.rotation.clone();
  }

  public setRotation(rotation: THREE.Euler): void {
    this.pivot.rotation.copy(rotation);
  }

  public getRotationWorld(): THREE.Euler {
    const quaternion = this.pivot.getWorldQuaternion(new THREE.Quaternion());

    return new THREE.Euler().setFromQuaternion(quaternion, this.pivot.rotation.order);
  }

  public setRotationWorld(rotation: THREE.Euler): void {
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    if (this.pivot.parent) {
      const parentWorldQuaternion = this.pivot.parent.getWorldQuaternion(new THREE.Quaternion());
      quaternion.premultiply(parentWorldQuaternion.invert());
    }

    this.pivot.quaternion.copy(quaternion);
  }

  public getScale(): THREE.Vector3 {
    return this.mesh.scale.clone();
  }

  public setScale(scale: THREE.Vector3): void {
    this.mesh.scale.copy(scale);
  }

  public getPivotOffset(): THREE.Vector3 {
    return this.pivot.position.clone();
  }

  public setPivotOffset(offset: THREE.Vector3): void {
    this.pivot.position.copy(offset);
    this.mesh.position.copy(offset).negate();
  }

  public getPivotOffsetWorld(): THREE.Vector3 {
    return this.pivot.getWorldPosition(new THREE.Vector3());
  }

  public setPivotOffsetWorld(offset: THREE.Vector3): void {
    const local = this.pivot.parent
      ? this.pivot.parent.worldToLocal(offset.clone())
      : offset.clone();
    this.setPivotOffset(local);
  }

  public syncMeshToPivot(): void {
    this.mesh.position.copy(this.pivot.position).negate();
  }

  /** Rotation is rounded in degrees, not radians, to match the panel. */
  public roundTransform(decimals: number = kTransformRoundDecimals): void {
    this.group.position.set(
      roundTo(this.group.position.x, decimals),
      roundTo(this.group.position.y, decimals),
      roundTo(this.group.position.z, decimals)
    );

    this.pivot.position.set(
      roundTo(this.pivot.position.x, decimals),
      roundTo(this.pivot.position.y, decimals),
      roundTo(this.pivot.position.z, decimals)
    );

    this.pivot.rotation.set(
      THREE.MathUtils.degToRad(roundTo(THREE.MathUtils.radToDeg(this.pivot.rotation.x), decimals)),
      THREE.MathUtils.degToRad(roundTo(THREE.MathUtils.radToDeg(this.pivot.rotation.y), decimals)),
      THREE.MathUtils.degToRad(roundTo(THREE.MathUtils.radToDeg(this.pivot.rotation.z), decimals))
    );

    this.mesh.scale.set(
      roundTo(this.mesh.scale.x, decimals),
      roundTo(this.mesh.scale.y, decimals),
      roundTo(this.mesh.scale.z, decimals)
    );

    this.syncMeshToPivot();
  }

  public getSize(): THREE.Vector3 {
    const { width, height, depth } = (this.mesh.geometry as THREE.BoxGeometry).parameters;

    return new THREE.Vector3(width, height, depth);
  }

  /**
   * Rebuilds the box and edge geometries at the new size. The pivot-point
   * marker and selection outline color are untouched.
   */
  public resize(size: THREE.Vector3): void {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);

    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;

    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    this.edges.geometry.dispose();
    this.edges.geometry = edgesGeometry;
  }

  public dispose(): void {
    // Dispose geometries
    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    // Dispose materials
    if (this.mesh.material instanceof THREE.MeshBasicMaterial) {
      this.mesh.material.dispose();
    }

    if (this.edges.material instanceof THREE.LineBasicMaterial) {
      this.edges.material.dispose();
    }

    this.pivotMarker.dispose();

    // Remove from parent if attached
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  public getGroupUUID(): string {
    return this.group.uuid;
  }
}
