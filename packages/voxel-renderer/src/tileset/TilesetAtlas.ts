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
  defaultPadding,
  padAtlas,
  padAtlasRegion,
  tileUVRegion,
  type AtlasLayout,
  type AtlasRegion
} from "./atlasLayout.ts";

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
    const {
      cols,
      rows,
      tileSize
    } = resolved;
    const requested = padding ?? defaultPadding(tileSize);

    this.#padded = padAtlas(texture.image, {
      cols,
      rows,
      tileSize,
      padding: requested
    });

    this.def = resolved;
    this.layout = {
      cols,
      rows,
      tileSize,
      padding: this.#padded === null ? 0 : requested
    };

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
    return tileUVRegion(
      col,
      row,
      this.layout
    );
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

    const {
      cols,
      rows,
      tileSize
    } = this.layout;
    const region: AtlasRegion = bounds ?? {
      x: 0,
      y: 0,
      width: cols * tileSize,
      height: rows * tileSize
    };

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
