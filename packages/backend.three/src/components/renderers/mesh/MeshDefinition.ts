// Import Third-party Dependencies
import {
  type Actor,
  type Component,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { ShaderAssetType } from "../../../assets/shader.ts";
import {
  parseUniformData,
  readShaderUniforms,
  resolveShaderInputs,
  type ShaderAssets
} from "../shaderInputs.ts";
import {
  type MeshGeometry,
  MESH_GEOMETRY_DEFAULTS
} from "./MeshGeometry.ts";
import {
  captureMeshSurface,
  parseMeshSurface
} from "./MeshSurface.ts";
import {
  MeshRenderer,
  MESH_RENDERER_DEFAULTS,
  type MeshSettings
} from "./MeshRenderer.ts";

export type MeshAssets = ShaderAssets;

export interface MeshData extends MeshSettings {
  /**
   * Values of the shader's uniforms, keyed by uniform name.
   */
  uniforms: Systems.JSONObject;
}

export class MeshDefinition implements Systems.ComponentDefinition<
  MeshData,
  MeshRenderer<any>,
  MeshAssets
> {
  readonly type = "Mesh";
  readonly assets = {
    shader: ShaderAssetType
  };

  parse(
    data: Readonly<Systems.JSONObject>
  ): MeshData {
    const fields = new Systems.ComponentData(data);

    return {
      ...parseMeshSurface(fields),
      geometry: parseGeometry(fields.object("geometry") ?? new Systems.ComponentData({})),
      uniforms: parseUniformData(data)
    };
  }

  create(
    actor: Actor<any>,
    data: MeshData,
    context: Systems.ComponentContext<MeshAssets>
  ): MeshRenderer<any> {
    const { uniforms, ...settings } = data;

    return actor.addComponentAndGet(MeshRenderer, {
      ...settings,
      ...resolveShaderInputs(context.assets, uniforms)
    });
  }

  apply(
    component: MeshRenderer<any>,
    data: MeshData
  ): void {
    const { uniforms, ...settings } = data;
    component.configure(settings);

    const { shader } = component;
    if (shader !== null) {
      component.assignUniforms(readShaderUniforms(shader, uniforms));
    }
  }

  owns(
    component: Component
  ): component is MeshRenderer<any> {
    return component instanceof MeshRenderer;
  }

  capture(
    component: MeshRenderer<any>,
    stored: Readonly<Systems.JSONObject>
  ): Systems.JSONObject {
    const { settings } = component;
    const { uniforms } = stored;

    return {
      ...captureMeshSurface(settings),
      geometry: { ...settings.geometry },
      ...(uniforms === undefined ? {} : { uniforms })
    };
  }
}

function parseGeometry(
  fields: Systems.ComponentData
): MeshGeometry {
  const kind = fields.choice(
    "kind",
    MESH_GEOMETRY_DEFAULTS,
    MESH_RENDERER_DEFAULTS.geometry.kind
  );

  switch (kind) {
    case "box": {
      const defaults = MESH_GEOMETRY_DEFAULTS.box;

      return {
        kind,
        width: fields.number("width", defaults.width),
        height: fields.number("height", defaults.height),
        depth: fields.number("depth", defaults.depth),
        widthSegments: fields.number("widthSegments", defaults.widthSegments),
        heightSegments: fields.number("heightSegments", defaults.heightSegments),
        depthSegments: fields.number("depthSegments", defaults.depthSegments)
      };
    }
    case "sphere": {
      const defaults = MESH_GEOMETRY_DEFAULTS.sphere;

      return {
        kind,
        radius: fields.number("radius", defaults.radius),
        widthSegments: fields.number("widthSegments", defaults.widthSegments),
        heightSegments: fields.number("heightSegments", defaults.heightSegments)
      };
    }
    case "plane": {
      const defaults = MESH_GEOMETRY_DEFAULTS.plane;

      return {
        kind,
        width: fields.number("width", defaults.width),
        height: fields.number("height", defaults.height),
        widthSegments: fields.number("widthSegments", defaults.widthSegments),
        heightSegments: fields.number("heightSegments", defaults.heightSegments)
      };
    }
    case "cylinder": {
      const defaults = MESH_GEOMETRY_DEFAULTS.cylinder;

      return {
        kind,
        radiusTop: fields.number("radiusTop", defaults.radiusTop),
        radiusBottom: fields.number("radiusBottom", defaults.radiusBottom),
        height: fields.number("height", defaults.height),
        radialSegments: fields.number("radialSegments", defaults.radialSegments),
        heightSegments: fields.number("heightSegments", defaults.heightSegments),
        openEnded: fields.boolean("openEnded", defaults.openEnded)
      };
    }
    case "cone": {
      const defaults = MESH_GEOMETRY_DEFAULTS.cone;

      return {
        kind,
        radius: fields.number("radius", defaults.radius),
        height: fields.number("height", defaults.height),
        radialSegments: fields.number("radialSegments", defaults.radialSegments),
        heightSegments: fields.number("heightSegments", defaults.heightSegments),
        openEnded: fields.boolean("openEnded", defaults.openEnded)
      };
    }
    case "torus": {
      const defaults = MESH_GEOMETRY_DEFAULTS.torus;

      return {
        kind,
        radius: fields.number("radius", defaults.radius),
        tube: fields.number("tube", defaults.tube),
        radialSegments: fields.number("radialSegments", defaults.radialSegments),
        tubularSegments: fields.number("tubularSegments", defaults.tubularSegments)
      };
    }
    case "capsule": {
      const defaults = MESH_GEOMETRY_DEFAULTS.capsule;

      return {
        kind,
        radius: fields.number("radius", defaults.radius),
        height: fields.number("height", defaults.height),
        capSegments: fields.number("capSegments", defaults.capSegments),
        radialSegments: fields.number("radialSegments", defaults.radialSegments),
        heightSegments: fields.number("heightSegments", defaults.heightSegments)
      };
    }
  }
}
