// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import {
  FontAssetType,
  type Font
} from "../../../assets/font.ts";
import { ComponentData } from "../../../systems/scene/file/definitions/ComponentData.ts";
import type {
  ComponentContext,
  ComponentDefinition
} from "../../../systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../systems/scene/file/SceneFile.ts";
import type { Component } from "../../types.ts";
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

export class TextDefinition implements ComponentDefinition<
  TextSettings,
  TextRenderer<any>,
  TextAssets
> {
  readonly type = "Text";
  readonly assets = {
    font: FontAssetType
  };

  parse(
    data: Readonly<JSONObject>
  ): TextSettings {
    const fields = new ComponentData(data);
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
    context: ComponentContext<TextAssets>
  ): TextRenderer<any> {
    return actor.addComponentAndGet(TextRenderer, {
      ...data,
      font: context.assets.resolve("font")
    });
  }

  apply(
    component: TextRenderer<any>,
    data: TextSettings
  ): void {
    component.configure(data);
  }

  owns(
    component: Component
  ): component is TextRenderer<any> {
    return component instanceof TextRenderer;
  }

  capture(
    component: TextRenderer<any>
  ): JSONObject {
    const { settings } = component;

    return {
      ...settings,
      ...captureMeshSurface(settings)
    };
  }
}
