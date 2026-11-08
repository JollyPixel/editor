// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorComponent } from "../../../../core/actor/ActorComponent.ts";
import type { Actor } from "../../../../core/actor/Actor.ts";
import type {
  ShadedMaterial,
  Shader,
  ShaderUniformValues
} from "../../../assets/shader.ts";
import type { WorldDefaultContext } from "../../../../core/systems/World.ts";
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

export interface MeshRendererCreateOptions extends MeshRendererOptions {
  /**
   * Builds the material the mesh renders with. The mesh then ignores the
   * material settings.
   * @default null
   */
  shader?: Shader | null;
  /**
   * Values passed to the shader; a missing uniform keeps its declared default.
   * @default {}
   */
  uniforms?: ShaderUniformValues;
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
  #shader: Shader | null;
  #shading: ShadedMaterial | null;

  constructor(
    actor: Actor<TContext>,
    options: MeshRendererCreateOptions = {}
  ) {
    super({
      actor,
      typeName: "MeshRenderer"
    });

    this.#settings = mergeSettings(MESH_RENDERER_DEFAULTS, options);
    const geometry = createMeshGeometry(this.#settings.geometry);
    const { shader = null, uniforms = {} } = options;
    this.#shader = shader;
    this.#shading = shader?.createMaterial(uniforms) ?? null;
    this.#surface = this.#shading === null ?
      SurfaceMesh.standard(actor.node.object3D, geometry, this.#settings) :
      SurfaceMesh.shaded(
        actor.node.object3D,
        geometry,
        this.#settings,
        this.#shading.material
      );
    this.addTeardown(() => this.#surface.dispose());
  }

  get threeMesh(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
    return this.#surface.mesh;
  }

  get shader(): Shader | null {
    return this.#shader;
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

  assignUniforms(
    values: ShaderUniformValues
  ): this {
    this.#shading?.assign(values);

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
