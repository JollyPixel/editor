// Import Third-party Dependencies
import {
  FontLoader,
  type Font
} from "three/examples/jsm/loaders/FontLoader.js";

// Import Internal Dependencies
import {
  Assets
} from "../../../systems/index.js";

Assets.registry.loader(
  {
    extensions: [".typeface.json"],
    type: "font"
  },
  (asset, context) => {
    const fontLoader = new FontLoader(context.manager)
      .setPath(asset.path);

    return fontLoader.loadAsync(asset.name + asset.ext);
  }
);

export const font = Assets.lazyLoad<Font>();

export type { Font };
