// Import Third-party Dependencies
import {
  FontLoader,
  type Font
} from "three/examples/jsm/loaders/FontLoader.js";

// Import Internal Dependencies
import { AssetLoader } from "../../../systems/index.ts";

export const FontAssetLoader = new AssetLoader<Font>({
  type: "font",
  extensions: [".typeface.json"],
  load: (asset, context) => {
    const fontLoader = new FontLoader(context.manager)
      .setPath(asset.path);

    return fontLoader.loadAsync(asset.name + asset.ext);
  }
});

export type { Font };
