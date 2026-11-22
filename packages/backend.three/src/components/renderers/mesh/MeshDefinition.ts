// Import Third-party Dependencies
import {
  type Actor,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { ShaderAssetType } from "../../../assets/Shader.ts";
import { ConfigurableDefinition } from "../../ConfigurableDefinition.ts";
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

export class MeshDefinition extends ConfigurableDefinition<
  MeshData,
  MeshRenderer<any>,
  MeshAssets
> {
  readonly type = "Mesh";
  protected readonly component = MeshRenderer;
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

  override apply(
    component: MeshRenderer<any>,
    data: MeshData
  ): void {
    super.apply(component, data);

    const { shader } = component;
    if (shader !== null) {
      component.assignUniforms(readShaderUniforms(shader, data.uniforms));
    }
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
  const entries = Object.entries(MESH_GEOMETRY_DEFAULTS[kind]).map(
    ([key, fallback]) => [key, parseField(fields, key, fallback)]
  );

  return Object.fromEntries(entries) as MeshGeometry;
}

function parseField(
  fields: Systems.ComponentData,
  key: string,
  fallback: unknown
): unknown {
  switch (typeof fallback) {
    case "number":
      return fields.number(key, fallback);
    case "boolean":
      return fields.boolean(key, fallback);
    default:
      return fallback;
  }
}
