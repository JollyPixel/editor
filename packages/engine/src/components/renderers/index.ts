export * from "./sprite/SpriteRenderer.class.ts";
export * from "./model/ModelRenderer.ts";
export * from "./text/TextRenderer.class.ts";

// Import Internal Dependencies
import {
  model,
  type Model
} from "./model/loader.ts";
import {
  font,
  type Font
} from "./text/loader.ts";

export const Loaders = {
  model,
  font
} as const;

export type {
  Model,
  Font
};
