// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

export interface DisposeObject3DOptions {
  /**
   * Dispose the textures reachable from the traversed materials.
   * Disabled by default because a single texture is commonly shared by
   * several materials (and often owned by an asset library).
   * @default false
   */
  textures?: boolean;
  /**
   * Detach the root from its parent before disposing it.
   * @default true
   */
  detach?: boolean;
  /**
   * Stop the traversal on nested actor object3D (they own their own
   * destruction). The root is always traversed.
   * @default false
   */
  stopAtActors?: boolean;
}

interface Disposable {
  dispose(): void;
}

/**
 * Release the GPU resources owned by an Object3D subtree.
 */
export function disposeObject3D(
  root: THREE.Object3D,
  options: DisposeObject3DOptions = {}
): void {
  const {
    textures: disposeTextures = false,
    detach = true,
    stopAtActors = false
  } = options;

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const disposables = new Set<Disposable>();

  collect(root, true);

  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    if (disposeTextures) {
      collectTextures(material, textures);
    }
    material.dispose();
  }
  for (const texture of textures) {
    disposeTexture(texture);
  }
  for (const disposable of disposables) {
    disposable.dispose();
  }

  if (detach) {
    root.removeFromParent();
  }
  root.clear();

  function collect(
    object: THREE.Object3D,
    isRoot: boolean
  ): void {
    if (!isRoot && stopAtActors && object.userData.isActor === true) {
      return;
    }

    collectNode(object, geometries, materials, disposables);

    for (const child of object.children) {
      collect(child, false);
    }
  }
}

function collectNode(
  object: THREE.Object3D,
  geometries: Set<THREE.BufferGeometry>,
  materials: Set<THREE.Material>,
  disposables: Set<Disposable>
): void {
  const candidate = object as Partial<THREE.Mesh> &
    Partial<THREE.SkinnedMesh> &
    Partial<THREE.CubeCamera> &
    Partial<Disposable>;

  if (!ownsItsResources(candidate)) {
    if (isBufferGeometry(candidate.geometry)) {
      geometries.add(candidate.geometry);
    }

    const nodeMaterials = Array.isArray(candidate.material) ?
      candidate.material :
      [candidate.material];
    for (const material of nodeMaterials) {
      if (isMaterial(material)) {
        materials.add(material);
      }
    }
  }

  if (isDisposable(candidate.skeleton)) {
    disposables.add(candidate.skeleton);
  }
  if (isDisposable(candidate.renderTarget)) {
    disposables.add(candidate.renderTarget);
  }
  if (isDisposable(candidate)) {
    disposables.add(candidate);
  }
}

function ownsItsResources(
  candidate: Partial<Disposable>
): boolean {
  return isDisposable(candidate) &&
    !hasFlag(candidate, "isInstancedMesh") &&
    !hasFlag(candidate, "isBatchedMesh");
}

function collectTextures(
  material: THREE.Material,
  textures: Set<THREE.Texture>
): void {
  for (const value of Object.values(material)) {
    if (isTexture(value)) {
      textures.add(value);
    }
  }

  const { uniforms } = material as Partial<THREE.ShaderMaterial>;
  if (!uniforms) {
    return;
  }

  for (const uniform of Object.values(uniforms)) {
    if (isTexture(uniform?.value)) {
      textures.add(uniform.value);
    }
  }
}

function disposeTexture(
  texture: THREE.Texture
): void {
  texture.dispose();

  // ImageBitmap keeps CPU-side resources alive until it is closed,
  // and three.js leaves that call to the application.
  const { image } = texture;
  if (
    typeof ImageBitmap !== "undefined" &&
    image instanceof ImageBitmap
  ) {
    image.close();
  }
}

function isBufferGeometry(
  value: unknown
): value is THREE.BufferGeometry {
  return hasFlag(value, "isBufferGeometry");
}

function isMaterial(
  value: unknown
): value is THREE.Material {
  return hasFlag(value, "isMaterial");
}

function isTexture(
  value: unknown
): value is THREE.Texture {
  return hasFlag(value, "isTexture");
}

function isDisposable(
  value: unknown
): value is Disposable {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Disposable).dispose === "function"
  );
}

function hasFlag(
  value: unknown,
  flag: string
): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)[flag] === true
  );
}
