// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  resolveTilesetDefinition,
  type ResolvedTilesetDefinition,
  type TilesetDefinition,
  type TilesetImage,
  type TilesetTexture,
  type TilesetUVRegion
} from "./types.ts";
import {
  AtlasLayout,
  type AtlasRegion
} from "./AtlasLayout.ts";
import {
  padAtlas,
  padAtlasRegion
} from "./padAtlas.ts";

export class TilesetAtlas {
  readonly def: ResolvedTilesetDefinition;
  readonly layout: AtlasLayout;
  readonly sourceTexture: TilesetTexture;
  readonly texture: TilesetTexture;

  #padded: HTMLCanvasElement | null;

  constructor(
    def: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>,
    padding: number | null = null
  ) {
    const resolved = resolveTilesetDefinition(
      def,
      texture.image
    );
    const requested = new AtlasLayout({
      cols: resolved.cols,
      rows: resolved.rows,
      tileSize: resolved.tileSize,
      padding: padding ?? undefined
    });

    this.#padded = padAtlas(texture.image, requested);

    this.def = resolved;
    this.layout = this.#padded === null ?
      requested.withoutPadding() :
      requested;

    this.sourceTexture = texture;
    this.texture = this.#padded === null ?
      texture :
      new THREE.CanvasTexture(this.#padded);

    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
  }

  uvFor(
    col: number,
    row: number
  ): TilesetUVRegion {
    return this.layout.uvFor(col, row);
  }

  updateSource(
    image: TilesetImage,
    bounds?: AtlasRegion
  ): void {
    this.sourceTexture.image = image;
    this.sourceTexture.needsUpdate = true;

    if (this.#padded === null) {
      return;
    }

    const region: AtlasRegion = bounds ?? this.layout.sourceBounds();

    padAtlasRegion(
      this.#padded,
      image,
      this.layout,
      region
    );
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    if (this.sourceTexture !== this.texture) {
      this.sourceTexture.dispose();
    }
    this.#padded = null;
  }
}
