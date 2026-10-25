// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import type { RenderViewport } from "../../systems/rendering/Renderer.ts";
import { ComponentData } from "../../systems/scene/file/ComponentData.ts";
import type {
  ComponentContext,
  ComponentDefinition
} from "../../systems/scene/file/ComponentDefinition.ts";
import type { JSONObject } from "../../systems/scene/file/SceneFile.ts";
import {
  CameraComponent,
  CAMERA_DEFAULTS,
  type CameraOptions,
  type CameraProjectionMode
} from "./Camera.ts";

// CONSTANTS
const kProjectionModes: Record<CameraProjectionMode, true> = {
  perspective: true,
  orthographic: true
};

export type CameraData = Required<Pick<
  CameraOptions,
  "projectionMode" | "fov" | "near" | "far" | "orthographicScale" | "viewport" | "depth"
>>;

export class CameraDefinition implements ComponentDefinition<
  CameraData,
  CameraComponent<any>
> {
  readonly type = "Camera";

  parse(
    data: Readonly<JSONObject>
  ): CameraData {
    const fields = new ComponentData(data);

    return {
      projectionMode: fields.choice(
        "projectionMode",
        kProjectionModes,
        CAMERA_DEFAULTS.projectionMode
      ),
      fov: fields.number("fov", CAMERA_DEFAULTS.fov),
      near: fields.number("near", CAMERA_DEFAULTS.near),
      far: fields.number("far", CAMERA_DEFAULTS.far),
      orthographicScale: fields.number(
        "orthographicScale",
        CAMERA_DEFAULTS.orthographicScale
      ),
      viewport: parseViewport(fields.object("viewport")),
      depth: fields.number("depth", CAMERA_DEFAULTS.depth)
    };
  }

  create(
    actor: Actor<any>,
    data: CameraData,
    context: ComponentContext
  ): CameraComponent<any> {
    return actor.addComponentAndGet(CameraComponent, {
      ...data,
      render: context.mode === "play"
    });
  }

  apply(
    component: CameraComponent<any>,
    data: CameraData
  ): void {
    component
      .setProjectionMode(data.projectionMode)
      .setFov(data.fov)
      .setNearFar(data.near, data.far)
      .setOrthographicScale(data.orthographicScale)
      .setViewport(data.viewport)
      .setDepth(data.depth);
  }
}

function parseViewport(
  fields: ComponentData | null
): RenderViewport | null {
  if (fields === null) {
    return null;
  }

  return {
    x: fields.number("x", 0),
    y: fields.number("y", 0),
    width: fields.number("width", 1),
    height: fields.number("height", 1)
  };
}
