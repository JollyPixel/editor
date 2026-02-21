// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kPointTextureSize = 256;
const kPointSize = 15;
const kPivotColor = 0xff00ff;
const kEdgeDefaultColor = 0x000000;
const kEdgeSelectedColor = 0xff00ff;

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
  private mesh: THREE.Mesh;
  private pivotPoint: THREE.Points;
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

    // Create the pivot group
    this.group = new THREE.Group();
    this.group.position.copy(pos);

    // Create the mesh
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
    this.mesh.position.copy(pivotPos);
    this.mesh.scale.x = scale.x;
    this.mesh.scale.y = scale.y;
    this.mesh.scale.z = scale.z;
    const meshName = name || `mesh_${this.group.uuid}`;
    this.mesh.name = meshName;

    // Create edges
    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: kEdgeDefaultColor });
    this.edges = new THREE.LineSegments(edgesGeo, edgesMat);
    this.edges.name = "edges";
    this.mesh.add(this.edges);

    // Add mesh to group
    this.group.add(this.mesh);

    // Create pivot point
    this.pivotPoint = this.createPivotPoint(pos);
    this.group.add(this.pivotPoint);
  }

  private createPivotPoint(pos: THREE.Vector3): THREE.Points {
    const pivotPointGeo = new THREE.BufferGeometry();
    pivotPointGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));

    const pivotPointMat = new THREE.PointsMaterial({
      color: kPivotColor,
      size: kPointSize,
      sizeAttenuation: false,
      map: this.pointTexture(kPointTextureSize)
    });
    pivotPointMat.depthTest = false;
    pivotPointMat.transparent = true;

    const pivotPoint = new THREE.Points(pivotPointGeo, pivotPointMat);
    pivotPoint.name = "pivot_visual";
    pivotPoint.visible = false;
    pivotPoint.renderOrder = 1;
    pivotPoint.position.copy(pos);

    return pivotPoint;
  }

  private pointTexture(size: number = 64): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  public getGroup(): THREE.Group {
    return this.group;
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

    this.pivotPoint.visible = true;
  }

  public deselect(): void {
    if (!this.isSelected) {
      return;
    }

    this.isSelected = false;

    if (this.edges.material instanceof THREE.LineBasicMaterial) {
      this.edges.material.color.set(kEdgeDefaultColor);
    }

    this.pivotPoint.visible = false;
  }

  public isSelectedState(): boolean {
    return this.isSelected;
  }

  public setTexture(texture: THREE.Texture | null): void {
    if (this.mesh.material instanceof THREE.MeshBasicMaterial) {
      this.mesh.material.map = texture;
      this.mesh.material.needsUpdate = true;
    }
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

    if (this.pivotPoint.material instanceof THREE.PointsMaterial) {
      this.pivotPoint.material.dispose();
      if (this.pivotPoint.material.map) {
        this.pivotPoint.material.map.dispose();
      }
    }

    // Remove from parent if attached
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  public getGroupUUID(): string {
    return this.group.uuid;
  }
}
