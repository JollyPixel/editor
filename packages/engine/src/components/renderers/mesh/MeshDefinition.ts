// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import { ComponentData } from "../../../systems/scene/file/ComponentData.ts";
import type {
  ComponentDefinition
} from "../../../systems/scene/file/ComponentDefinition.ts";
import type { JSONObject } from "../../../systems/scene/file/SceneFile.ts";
import {
  type MeshGeometry,
  MESH_GEOMETRY_DEFAULTS
} from "./MeshGeometry.ts";
import {
  MeshRenderer,
  MESH_RENDERER_DEFAULTS,
  type MeshMaterialOptions,
  type MeshRendererOptions
} from "./MeshRenderer.ts";

export class MeshDefinition implements ComponentDefinition<
  MeshRendererOptions,
  MeshRenderer<any>
> {
  readonly type = "Mesh";

  parse(
    data: Readonly<JSONObject>
  ): MeshRendererOptions {
    const fields = new ComponentData(data);

    return {
      geometry: parseGeometry(fields.object("geometry") ?? new ComponentData({})),
      material: parseMaterial(fields.object("material") ?? new ComponentData({})),
      castShadow: fields.boolean("castShadow", MESH_RENDERER_DEFAULTS.castShadow),
      receiveShadow: fields.boolean("receiveShadow", MESH_RENDERER_DEFAULTS.receiveShadow)
    };
  }

  create(
    actor: Actor<any>,
    data: MeshRendererOptions
  ): MeshRenderer<any> {
    return actor.addComponentAndGet(MeshRenderer, data);
  }

  apply(
    component: MeshRenderer<any>,
    data: MeshRendererOptions
  ): void {
    component.configure(data);
  }
}

function parseGeometry(
  fields: ComponentData
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

function parseMaterial(
  fields: ComponentData
): Required<MeshMaterialOptions> {
  const defaults = MESH_RENDERER_DEFAULTS.material;

  return {
    color: fields.color("color", defaults.color),
    roughness: fields.number("roughness", defaults.roughness),
    metalness: fields.number("metalness", defaults.metalness),
    emissive: fields.color("emissive", defaults.emissive),
    emissiveIntensity: fields.number("emissiveIntensity", defaults.emissiveIntensity),
    opacity: fields.number("opacity", defaults.opacity),
    flatShading: fields.boolean("flatShading", defaults.flatShading)
  };
}
