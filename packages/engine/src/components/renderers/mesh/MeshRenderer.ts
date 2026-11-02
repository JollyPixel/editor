// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

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
import {
  MESH_SURFACE_DEFAULTS,
  mergeMeshSurface,
  type MeshSurfaceOptions,
  type MeshSurfaceSettings
} from "./MeshSurface.ts";
import { SurfaceMesh } from "./SurfaceMesh.ts";

export interface MeshRendererOptions extends MeshSurfaceOptions {
  /**
   * @default a 1x1x1 box
   */
  geometry?: MeshGeometry;
}

export interface MeshSettings extends MeshSurfaceSettings {
  geometry: MeshGeometry;
}

// CONSTANTS
export const MESH_RENDERER_DEFAULTS = {
  ...MESH_SURFACE_DEFAULTS,
  geometry: MESH_GEOMETRY_DEFAULTS.box
} as const satisfies MeshSettings;

export class MeshRenderer<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  #settings: MeshSettings;
  #surface: SurfaceMesh;

  constructor(
    actor: Actor<TContext>,
    options: MeshRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "MeshRenderer"
    });

    this.#settings = mergeSettings(MESH_RENDERER_DEFAULTS, options);
    this.#surface = new SurfaceMesh(
      actor.object3D,
      createMeshGeometry(this.#settings.geometry),
      this.#settings
    );
    this.addTeardown(() => this.#surface.dispose());
  }

  get threeMesh(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
    return this.#surface.mesh;
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
      this.#surface.replaceGeometry(createMeshGeometry(this.#settings.geometry));
    }
    this.#surface.configure(this.#settings);

    return this;
  }
}

function mergeSettings(
  settings: MeshSettings,
  options: MeshRendererOptions
): MeshSettings {
  return {
    ...mergeMeshSurface(settings, options),
    geometry: options.geometry ?? settings.geometry
  };
}
