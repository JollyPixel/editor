// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import { ComponentData } from "../../systems/scene/file/ComponentData.ts";
import type {
  ComponentDefinition
} from "../../systems/scene/file/ComponentDefinition.ts";
import type { JSONObject } from "../../systems/scene/file/SceneFile.ts";
import {
  LightComponent,
  LIGHT_DEFAULTS,
  type LightKind,
  type LightSettings
} from "./LightComponent.ts";

// CONSTANTS
const kLightKinds: Record<LightKind, true> = {
  ambient: true,
  hemisphere: true,
  directional: true,
  point: true,
  spot: true
};

export class LightDefinition implements ComponentDefinition<
  LightSettings,
  LightComponent<any>
> {
  readonly type = "Light";

  parse(
    data: Readonly<JSONObject>
  ): LightSettings {
    const fields = new ComponentData(data);

    return {
      kind: fields.choice("kind", kLightKinds, LIGHT_DEFAULTS.kind),
      color: fields.color("color", LIGHT_DEFAULTS.color),
      groundColor: fields.color("groundColor", LIGHT_DEFAULTS.groundColor),
      intensity: fields.number("intensity", LIGHT_DEFAULTS.intensity),
      distance: fields.number("distance", LIGHT_DEFAULTS.distance),
      decay: fields.number("decay", LIGHT_DEFAULTS.decay),
      angle: fields.number("angle", LIGHT_DEFAULTS.angle),
      penumbra: fields.number("penumbra", LIGHT_DEFAULTS.penumbra),
      castShadow: fields.boolean("castShadow", LIGHT_DEFAULTS.castShadow),
      shadowMapSize: fields.number("shadowMapSize", LIGHT_DEFAULTS.shadowMapSize),
      shadowBias: fields.number("shadowBias", LIGHT_DEFAULTS.shadowBias)
    };
  }

  create(
    actor: Actor<any>,
    data: LightSettings
  ): LightComponent<any> {
    return actor.addComponentAndGet(LightComponent, data);
  }

  apply(
    component: LightComponent<any>,
    data: LightSettings
  ): void {
    component.configure(data);
  }
}
