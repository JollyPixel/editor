// Import Third-party Dependencies
import {
  QueryParams,
  type Appearance
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { TextureImportPolicy } from "../../src/index.ts";
import { isTextureImportPolicy } from "../../src/textures/textures.ts";

// CONSTANTS
const kFeatureParams = new QueryParams((query) => {
  return {
    runtimeOff: query.string("runtime") === "off",
    empty: query.flag("empty"),
    importPolicy: parseImportPolicy(query.string("import-policy")),
    addDelay: parseDelay(query.number("add-delay"))
  };
});

export interface PixelArtFeaturesOptions {
  preview: boolean;
  starterRegion: boolean;
  uvCreateDelete: boolean;
  importPolicy: TextureImportPolicy;
  appearance: Appearance | null;
  addDelay: number;
}

export class PixelArtFeatures {
  static readonly editor = new PixelArtFeatures({
    preview: false,
    starterRegion: false,
    uvCreateDelete: false,
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
    importPolicy: "ask",
    appearance: null,
    addDelay: 0
  });

  readonly preview: boolean;
  readonly starterRegion: boolean;
  readonly uvCreateDelete: boolean;
  readonly importPolicy: TextureImportPolicy;
  readonly appearance: Appearance | null;
  readonly addDelay: number;

  constructor(
    options: PixelArtFeaturesOptions
  ) {
    this.preview = options.preview;
    this.starterRegion = options.starterRegion;
    this.uvCreateDelete = options.uvCreateDelete;
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
      importPolicy: params.importPolicy ?? this.importPolicy,
      appearance: this.appearance,
      addDelay: params.addDelay ?? this.addDelay
    });
  }
}

function parseImportPolicy(
  value: string | undefined
): TextureImportPolicy | undefined {
  return value !== undefined && isTextureImportPolicy(value) ?
    value :
    undefined;
}

function parseDelay(
  value: number | undefined
): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ?
    value :
    undefined;
}
