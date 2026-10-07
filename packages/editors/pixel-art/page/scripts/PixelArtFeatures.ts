// Import Third-party Dependencies
import {
  QueryParams,
  type Appearance
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { TextureImportPolicy } from "../../src/index.ts";
import { TextureImporter } from "../../src/textures/import/TextureImporter.ts";

// CONSTANTS
const kFeatureParams = new QueryParams((query) => {
  return {
    runtimeOff: query.string("runtime") === "off",
    empty: query.flag("empty"),
    importPolicy: TextureImporter.parsePolicy(query.string("import-policy")) ??
      undefined,
    addDelay: parseDelay(query.number("add-delay"))
  };
});

export interface PixelArtFeaturesOptions {
  preview: boolean;
  starterRegion: boolean;
  uvCreateDelete: boolean;
  uvResize: boolean;
  importPolicy: TextureImportPolicy;
  appearance: Appearance | null;
  addDelay: number;
}

export class PixelArtFeatures {
  static readonly editor = new PixelArtFeatures({
    preview: false,
    starterRegion: false,
    uvCreateDelete: false,
    uvResize: false,
    importPolicy: "replace",
    appearance: {
      theme: "dark",
      density: "comfortable"
    },
    addDelay: 0
  });

  static readonly playground = new PixelArtFeatures({
    preview: true,
    starterRegion: true,
    uvCreateDelete: true,
    uvResize: true,
    importPolicy: "ask",
    appearance: null,
    addDelay: 0
  });

  readonly preview: boolean;
  readonly starterRegion: boolean;
  readonly uvCreateDelete: boolean;
  readonly uvResize: boolean;
  readonly importPolicy: TextureImportPolicy;
  readonly appearance: Appearance | null;
  readonly addDelay: number;

  constructor(
    options: PixelArtFeaturesOptions
  ) {
    this.preview = options.preview;
    this.starterRegion = options.starterRegion;
    this.uvCreateDelete = options.uvCreateDelete;
    this.uvResize = options.uvResize;
    this.importPolicy = options.importPolicy;
    this.appearance = options.appearance;
    this.addDelay = options.addDelay;
  }

  withQuery(
    search?: string
  ): PixelArtFeatures {
    const params = kFeatureParams.read(search);

    return new PixelArtFeatures({
      preview: this.preview && !params.runtimeOff,
      starterRegion: this.starterRegion && !params.empty,
      uvCreateDelete: this.uvCreateDelete,
      uvResize: this.uvResize,
      importPolicy: params.importPolicy ?? this.importPolicy,
      appearance: this.appearance,
      addDelay: params.addDelay ?? this.addDelay
    });
  }
}

function parseDelay(
  value: number | undefined
): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ?
    value :
    undefined;
}
