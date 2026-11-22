// Import Third-party Dependencies
import {
  type Actor,
  type Component,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  CameraComponent,
  CAMERA_DEFAULTS,
  type CameraSettings
} from "./Camera.ts";
import type { CameraProjectionMode } from "./CameraProjection.ts";

// CONSTANTS
const kProjectionModes: Record<CameraProjectionMode, true> = {
  perspective: true,
  orthographic: true
};

export type CameraData = Required<CameraSettings>;

export class CameraDefinition implements Systems.ComponentDefinition<
  CameraData,
  CameraComponent<any>
> {
  readonly type = "Camera";

  parse(
    data: Readonly<Systems.JSONObject>
  ): CameraData {
    const fields = new Systems.ComponentData(data);

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
    context: Systems.ComponentContext
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
    component.configure(data);
  }

  owns(
    component: Component
  ): component is CameraComponent<any> {
    return component instanceof CameraComponent;
  }

  capture(
    component: CameraComponent<any>
  ): Systems.JSONObject {
    const { viewport, ...settings } = component.settings;

    return {
      ...settings,
      viewport: viewport === null ? null : { ...viewport }
    };
  }
}

function parseViewport(
  fields: Systems.ComponentData | null
): Systems.RenderViewport | null {
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
