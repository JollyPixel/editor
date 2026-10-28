// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorComponent } from "../../../actor/ActorComponent.ts";
import type { Actor } from "../../../actor/Actor.ts";
import type { WorldDefaultContext } from "../../../systems/World.ts";
import {
  type MeshGeometry,
  MESH_GEOMETRY_DEFAULTS,
  createMeshGeometry,
  isSameMeshGeometry
} from "./MeshGeometry.ts";

export interface MeshMaterialOptions {
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default 1
   */
  roughness?: number;
  /**
   * @default 0
   */
  metalness?: number;
  /**
   * @default "#000000"
   */
  emissive?: THREE.ColorRepresentation;
  /**
   * @default 1
   */
  emissiveIntensity?: number;
  /**
   * Below 1 the material renders as transparent.
   * @default 1
   */
  opacity?: number;
  /**
   * @default false
   */
  flatShading?: boolean;
}

export interface MeshRendererOptions {
  /**
   * @default a 1x1x1 box
   */
  geometry?: MeshGeometry;
  material?: MeshMaterialOptions;
  /**
   * @default false
   */
  castShadow?: boolean;
  /**
   * @default false
   */
  receiveShadow?: boolean;
}

export interface MeshSettings {
  geometry: MeshGeometry;
  material: Required<MeshMaterialOptions>;
  castShadow: boolean;
  receiveShadow: boolean;
}

// CONSTANTS
export const MESH_RENDERER_DEFAULTS = {
  geometry: MESH_GEOMETRY_DEFAULTS.box,
  material: {
    color: "#ffffff",
    roughness: 1,
    metalness: 0,
    emissive: "#000000",
    emissiveIntensity: 1,
    opacity: 1,
    flatShading: false
  },
  castShadow: false,
  receiveShadow: false
} as const satisfies MeshSettings;

export class MeshRenderer<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  #settings: MeshSettings;
  #mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

  constructor(
    actor: Actor<TContext>,
    options: MeshRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "MeshRenderer"
    });

    this.#settings = mergeSettings(MESH_RENDERER_DEFAULTS, options);
    this.#mesh = new THREE.Mesh(
      createMeshGeometry(this.#settings.geometry),
      new THREE.MeshStandardMaterial()
    );
    this.#write();

    actor.object3D.add(this.#mesh);
    this.addTeardown(() => {
      actor.object3D.remove(this.#mesh);
      this.#mesh.geometry.dispose();
      this.#mesh.material.dispose();
    });
  }

  get threeMesh(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
    return this.#mesh;
  }

  get geometry(): MeshGeometry {
    return this.#settings.geometry;
  }

  get settings(): Readonly<MeshSettings> {
    return this.#settings;
  }

  configure(
    options: MeshRendererOptions
  ): this {
    const previous = this.#settings;
    this.#settings = mergeSettings(previous, options);

    if (!isSameMeshGeometry(this.#settings.geometry, previous.geometry)) {
      this.#mesh.geometry.dispose();
      this.#mesh.geometry = createMeshGeometry(this.#settings.geometry);
    }
    this.#write();

    return this;
  }

  #write(): void {
    const { material, castShadow, receiveShadow } = this.#settings;

    writeMaterial(this.#mesh.material, material);
    this.#mesh.castShadow = castShadow;
    this.#mesh.receiveShadow = receiveShadow;
  }
}

function mergeSettings(
  settings: MeshSettings,
  options: MeshRendererOptions
): MeshSettings {
  return {
    geometry: options.geometry ?? settings.geometry,
    material: {
      ...settings.material,
      ...options.material
    },
    castShadow: options.castShadow ?? settings.castShadow,
    receiveShadow: options.receiveShadow ?? settings.receiveShadow
  };
}

function writeMaterial(
  material: THREE.MeshStandardMaterial,
  settings: Required<MeshMaterialOptions>
): void {
  material.color.set(settings.color);
  material.roughness = settings.roughness;
  material.metalness = settings.metalness;
  material.emissive.set(settings.emissive);
  material.emissiveIntensity = settings.emissiveIntensity;
  material.opacity = settings.opacity;

  const transparent = settings.opacity < 1;
  if (
    transparent !== material.transparent ||
    settings.flatShading !== material.flatShading
  ) {
    material.transparent = transparent;
    material.flatShading = settings.flatShading;
    material.needsUpdate = true;
  }
}
