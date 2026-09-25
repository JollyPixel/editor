// Import Third-party Dependencies
import type {
  ResolvedTileRef,
  TilesetImage,
  TilesetManager,
  TilesetTexture
} from "@jolly-pixel/voxel.renderer";

export interface PixelBuffer {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface TileRect {
  x: number;
  y: number;
  size: number;
}

export type ImagePixelReader = (image: TilesetImage) => PixelBuffer | null;

interface ProbeCache {
  version: number;
  image: TilesetImage;
  pixels: PixelBuffer | null | undefined;
  empty: Map<string, boolean>;
}

export function hasVisiblePixel(
  buffer: PixelBuffer,
  rect: TileRect,
  alphaCutoff: number
): boolean {
  const threshold = Math.max(1, Math.ceil(alphaCutoff * 255));
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(buffer.width, rect.x + rect.size);
  const bottom = Math.min(buffer.height, rect.y + rect.size);

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (buffer.data[(((y * buffer.width) + x) * 4) + 3] >= threshold) {
        return true;
      }
    }
  }

  return false;
}

export function readImagePixels(
  image: TilesetImage
): PixelBuffer | null {
  const isImage = "naturalWidth" in image;
  if (isImage && !image.complete) {
    return null;
  }

  const width = (isImage && image.naturalWidth) || image.width;
  const height = (isImage && image.naturalHeight) || image.height;
  if (width === 0 || height === 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  try {
    context.drawImage(image, 0, 0);

    return context.getImageData(0, 0, width, height);
  }
  catch {
    return null;
  }
}

export class TileOpacityProbe {
  #tilesetManager: TilesetManager;
  #reader: ImagePixelReader;
  #caches = new WeakMap<TilesetTexture, ProbeCache>();

  constructor(
    tilesetManager: TilesetManager,
    reader: ImagePixelReader = readImagePixels
  ) {
    this.#tilesetManager = tilesetManager;
    this.#reader = reader;
  }

  isEmpty(
    ref: ResolvedTileRef | undefined,
    alphaCutoff: number
  ): boolean {
    if (ref === undefined) {
      return true;
    }

    const atlas = this.#tilesetManager.get(ref.tilesetId);
    if (atlas === undefined) {
      return true;
    }

    const { tileSize } = atlas.def;
    const size = ref.size ?? tileSize;
    const key = `${ref.col}:${ref.row}:${size}:${alphaCutoff}`;
    const cache = this.#cacheOf(atlas.texture);
    const cached = cache.empty.get(key);
    if (cached !== undefined) {
      return cached;
    }

    if (cache.pixels === undefined) {
      cache.pixels = this.#reader(cache.image);
    }
    if (cache.pixels === null) {
      return false;
    }

    const empty = !hasVisiblePixel(
      cache.pixels,
      {
        x: ref.col * tileSize,
        y: ref.row * tileSize,
        size
      },
      alphaCutoff
    );
    cache.empty.set(key, empty);

    return empty;
  }

  #cacheOf(
    texture: TilesetTexture
  ): ProbeCache {
    const cached = this.#caches.get(texture);
    if (
      cached !== undefined &&
      cached.version === texture.version &&
      cached.image === texture.image
    ) {
      return cached;
    }

    const cache: ProbeCache = {
      version: texture.version,
      image: texture.image,
      pixels: undefined,
      empty: new Map()
    };
    this.#caches.set(texture, cache);

    return cache;
  }
}
