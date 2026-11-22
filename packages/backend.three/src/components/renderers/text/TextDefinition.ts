// Import Third-party Dependencies
import {
  type Actor,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { ConfigurableDefinition } from "../../ConfigurableDefinition.ts";
import {
  FontAssetType,
  type Font
} from "../../../assets/loaders/FontAssetLoader.ts";
import {
  captureMeshSurface,
  parseMeshSurface
} from "../mesh/MeshSurface.ts";
import {
  TextRenderer,
  TEXT_RENDERER_DEFAULTS,
  type TextAlign,
  type TextSettings
} from "./TextRenderer.ts";

export type TextAssets = {
  font: Font;
};

// CONSTANTS
const kTextAligns: Record<TextAlign, true> = {
  left: true,
  center: true,
  right: true
};

export class TextDefinition extends ConfigurableDefinition<
  TextSettings,
  TextRenderer<any>,
  TextAssets
> {
  readonly type = "Text";
  protected readonly component = TextRenderer;
  readonly assets = {
    font: FontAssetType
  };

  parse(
    data: Readonly<Systems.JSONObject>
  ): TextSettings {
    const fields = new Systems.ComponentData(data);
    const defaults = TEXT_RENDERER_DEFAULTS;

    return {
      ...parseMeshSurface(fields),
      text: fields.string("text", defaults.text),
      size: fields.number("size", defaults.size),
      depth: fields.number("depth", defaults.depth),
      curveSegments: fields.number("curveSegments", defaults.curveSegments),
      bevel: fields.boolean("bevel", defaults.bevel),
      bevelThickness: fields.number("bevelThickness", defaults.bevelThickness),
      bevelSize: fields.number("bevelSize", defaults.bevelSize),
      align: fields.choice("align", kTextAligns, defaults.align)
    };
  }

  create(
    actor: Actor<any>,
    data: TextSettings,
    context: Systems.ComponentContext<TextAssets>
  ): TextRenderer<any> {
    return actor.addComponentAndGet(TextRenderer, {
      ...data,
      font: context.assets.resolve("font")
    });
  }

  capture(
    component: TextRenderer<any>
  ): Systems.JSONObject {
    const { settings } = component;

    return {
      ...settings,
      ...captureMeshSurface(settings)
    };
  }
}
