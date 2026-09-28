// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { PulledMeshData } from "../types.ts";
import type { FaceTemplateTable } from "./FaceTemplateTable.ts";

// CONSTANTS
export const PULLED_FACE_WORDS = 2;
export const PULLED_BLENDED_FACE_WORDS = 4;
export const PULLED_BLEND_TEXELS = 2;
export const PULLED_MAX_BLEND_ENTRIES = 255;
export const PULLED_FACE_ROW = 2048;
export const PULLED_CELL_BITS = 10;
export const PULLED_TEMPLATE_BITS = 22;
export const PULLED_AO_BITS = 8;
const kCellMask = (1 << PULLED_CELL_BITS) - 1;
const kTemplateMask = (1 << PULLED_TEMPLATE_BITS) - 1;
const kFlipShift = PULLED_TEMPLATE_BITS + PULLED_AO_BITS;
const kQuadCorners = [0, 1, 2, 0, 2, 3];
const kCornerCount = 4;
const kQuadTriangles = [[0, 1, 2], [0, 2, 3]];

const kA = new THREE.Vector3();
const kB = new THREE.Vector3();
const kC = new THREE.Vector3();
const kCell = new THREE.Vector3();
const kPoint = new THREE.Vector3();
const kWorldPoint = new THREE.Vector3();
const kSphere = new THREE.Sphere();
const kSphereHit = new THREE.Vector3();
const kRay = new THREE.Ray();
const kInverse = new THREE.Matrix4();

export interface PulledChunkGeometryOptions {
  words: Uint32Array<ArrayBuffer>;
  faceCount: number;
  templates: FaceTemplateTable;
  bounds: THREE.Box3;
  /**
   * Switches faces to the blended four-word layout.
   */
  blendPalette?: Float32Array<ArrayBuffer>;
}

export class PulledChunkGeometry extends THREE.InstancedBufferGeometry {
  static wordCapacity(
    faceCount: number,
    faceWords = PULLED_FACE_WORDS
  ): number {
    const [width, height] = textureSize(faceCount);

    return width * height * faceWords;
  }

  static faceWordsOf(
    data: Pick<PulledMeshData, "blendPalette">
  ): number {
    return data.blendPalette === undefined ?
      PULLED_FACE_WORDS :
      PULLED_BLENDED_FACE_WORDS;
  }

  static byteLength(
    data: PulledMeshData
  ): number {
    return data.words.byteLength +
      (data.blendPalette?.byteLength ?? 0) +
      (kCornerCount * 3 * Float32Array.BYTES_PER_ELEMENT * 2) +
      (kQuadCorners.length * Uint16Array.BYTES_PER_ELEMENT);
  }

  static fromMeshData(
    data: PulledMeshData,
    templates: FaceTemplateTable
  ): PulledChunkGeometry {
    const [minX, minY, minZ, maxX, maxY, maxZ] = data.bounds;

    return new PulledChunkGeometry({
      words: data.words,
      faceCount: data.faceCount,
      templates,
      bounds: new THREE.Box3(
        new THREE.Vector3(minX, minY, minZ),
        new THREE.Vector3(maxX, maxY, maxZ)
      ),
      blendPalette: data.blendPalette
    });
  }

  readonly faces: THREE.DataTexture;
  readonly faceCount: number;
  readonly faceWords: number;
  readonly templates: FaceTemplateTable;
  readonly blends: THREE.DataTexture | null;

  #words: Uint32Array<ArrayBuffer>;

  constructor(
    options: PulledChunkGeometryOptions
  ) {
    super();

    const {
      words,
      faceCount,
      templates,
      bounds,
      blendPalette
    } = options;
    const faceWords = PulledChunkGeometry.faceWordsOf({ blendPalette });
    const [width, height] = textureSize(faceCount);
    const capacity = width * height * faceWords;
    if (words.length !== capacity) {
      throw new RangeError(
        `PulledChunkGeometry: expected ${capacity} words for ${faceCount} faces, received ${words.length}.`
      );
    }

    this.faceCount = faceCount;
    this.faceWords = faceWords;
    this.templates = templates;
    this.#words = words;
    this.faces = dataTexture(
      new THREE.DataTexture(
        words,
        width,
        height,
        faceWords === PULLED_FACE_WORDS ?
          THREE.RGIntegerFormat :
          THREE.RGBAIntegerFormat,
        THREE.UnsignedIntType
      )
    );
    this.blends = blendPalette === undefined ?
      null :
      dataTexture(
        new THREE.DataTexture(
          blendPalette,
          blendPalette.length / 4,
          1,
          THREE.RGBAFormat,
          THREE.FloatType
        )
      );

    this.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(kCornerCount * 3).map(
          (_, index) => (index % 3 === 0 ? index / 3 : 0)
        ),
        3
      )
    );
    this.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(kCornerCount * 3), 3)
    );
    this.setIndex(
      new THREE.BufferAttribute(new Uint16Array(kQuadCorners), 1)
    );
    this.instanceCount = faceCount;
    this.boundingBox = bounds.clone();
    this.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
  }

  copyCornerTo(
    face: number,
    corner: number,
    target: THREE.Vector3
  ): THREE.Vector3 {
    const offset = face * this.faceWords;
    const cell = this.#words[offset];
    const packed = this.#words[offset + 1];
    const flip = packed >>> kFlipShift;

    this.templates.copyVertexTo(
      packed & kTemplateMask,
      (corner + flip) & 3,
      target
    );

    return target.add(kCell.set(
      cell & kCellMask,
      (cell >>> PULLED_CELL_BITS) & kCellMask,
      (cell >>> (PULLED_CELL_BITS * 2)) & kCellMask
    ));
  }

  toIndexedGeometry(): THREE.BufferGeometry {
    const positions = new Float32Array(this.faceCount * 4 * 3);
    const indices = new Uint32Array(this.faceCount * 6);

    for (let face = 0; face < this.faceCount; face++) {
      for (let corner = 0; corner < 4; corner++) {
        this.copyCornerTo(face, corner, kA)
          .toArray(positions, ((face * 4) + corner) * 3);
      }
      for (let i = 0; i < 6; i++) {
        indices[(face * 6) + i] = (face * 4) + kQuadCorners[i];
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    return geometry;
  }

  raycastMesh(
    mesh: THREE.Mesh,
    raycaster: THREE.Raycaster,
    intersects: THREE.Intersection[]
  ): void {
    const material = mesh.material;
    if (Array.isArray(material) || this.boundingSphere === null) {
      return;
    }

    kSphere.copy(this.boundingSphere).applyMatrix4(mesh.matrixWorld);
    kRay.copy(raycaster.ray).recast(raycaster.near);
    if (!kSphere.containsPoint(kRay.origin)) {
      if (kRay.intersectSphere(kSphere, kSphereHit) === null) {
        return;
      }
      const range = raycaster.far - raycaster.near;
      if (kRay.origin.distanceToSquared(kSphereHit) > range * range) {
        return;
      }
    }

    kInverse.copy(mesh.matrixWorld).invert();
    kRay.copy(raycaster.ray).applyMatrix4(kInverse);
    if (this.boundingBox !== null && !kRay.intersectsBox(this.boundingBox)) {
      return;
    }

    for (let face = 0; face < this.faceCount; face++) {
      for (let triangle = 0; triangle < kQuadTriangles.length; triangle++) {
        const [a, b, c] = kQuadTriangles[triangle];
        const hit = this.#intersect(mesh, material, raycaster, face, a, b, c);
        if (hit !== null) {
          hit.faceIndex = (face * 2) + triangle;
          intersects.push(hit);
        }
      }
    }
  }

  override dispose(): void {
    this.faces.dispose();
    this.blends?.dispose();
    super.dispose();
  }

  // eslint-disable-next-line max-params
  #intersect(
    mesh: THREE.Mesh,
    material: THREE.Material,
    raycaster: THREE.Raycaster,
    face: number,
    a: number,
    b: number,
    c: number
  ): THREE.Intersection | null {
    this.copyCornerTo(face, a, kA);
    this.copyCornerTo(face, b, kB);
    this.copyCornerTo(face, c, kC);

    const point = material.side === THREE.BackSide ?
      kRay.intersectTriangle(kC, kB, kA, true, kPoint) :
      kRay.intersectTriangle(kA, kB, kC, material.side === THREE.FrontSide, kPoint);
    if (point === null) {
      return null;
    }

    kWorldPoint.copy(point).applyMatrix4(mesh.matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(kWorldPoint);
    if (distance < raycaster.near || distance > raycaster.far) {
      return null;
    }

    const template = this.#words[(face * this.faceWords) + 1] & kTemplateMask;
    const surfaceNormal = this.templates.copyNormalTo(template, new THREE.Vector3());
    if (surfaceNormal.dot(kRay.direction) > 0) {
      surfaceNormal.multiplyScalar(-1);
    }

    return {
      distance,
      point: kWorldPoint.clone(),
      object: mesh,
      normal: surfaceNormal,
      barycoord: THREE.Triangle.getBarycoord(point, kA, kB, kC, new THREE.Vector3()) ??
        undefined,
      face: {
        a: (face * 4) + a,
        b: (face * 4) + b,
        c: (face * 4) + c,
        normal: THREE.Triangle.getNormal(kA, kB, kC, new THREE.Vector3()),
        materialIndex: 0
      }
    };
  }
}

function textureSize(
  faceCount: number
): [width: number, height: number] {
  const width = Math.max(1, Math.min(faceCount, PULLED_FACE_ROW));

  return [width, Math.max(1, Math.ceil(faceCount / width))];
}

function dataTexture(
  texture: THREE.DataTexture
): THREE.DataTexture {
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}
