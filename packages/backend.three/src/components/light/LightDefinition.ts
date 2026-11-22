// Import Third-party Dependencies
import {
  type Actor,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { toHexColor } from "../../utils/toHexColor.ts";
import { ConfigurableDefinition } from "../ConfigurableDefinition.ts";
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

export class LightDefinition extends ConfigurableDefinition<
  LightSettings,
  LightComponent<any>
> {
  readonly type = "Light";
  protected readonly component = LightComponent;

  parse(
    data: Readonly<Systems.JSONObject>
  ): LightSettings {
    const fields = new Systems.ComponentData(data);

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

  capture(
    component: LightComponent<any>
  ): Systems.JSONObject {
    const { settings } = component;

    return {
      ...settings,
      color: toHexColor(settings.color),
      groundColor: toHexColor(settings.groundColor)
    };
  }
}
