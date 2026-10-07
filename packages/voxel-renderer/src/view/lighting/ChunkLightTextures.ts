// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelCoord } from "../../document/world/types.ts";
import type { BlockLightField } from "./BlockLightField.ts";
import type { BlockLightSources } from "./BlockLightSources.ts";
import type { LightChunkKey } from "./LightGrid.ts";

// CONSTANTS
const kTexelBytes = 4;

export interface ChunkLightTexturesOptions {
  field: BlockLightField;
  sources: BlockLightSources;
}

export interface LitTarget {
  readonly key: string;
  readonly origin: Readonly<VoxelCoord>;
}

interface LightTexture {
  texture: THREE.Data3DTexture;
  texels: Uint32Array<ArrayBuffer>;
  origin: VoxelCoord;
}

export class ChunkLightTextures {
  #field: BlockLightField;
  #sources: BlockLightSources;
  #textures = new Map<string, LightTexture>();
  #cells = new Uint16Array(0);

  constructor(
    options: ChunkLightTexturesOptions
  ) {
    this.#field = options.field;
    this.#sources = options.sources;
  }

  get span(): number {
    return this.#field.grid.size + 2;
  }

  get size(): number {
    return this.#textures.size;
  }

  textureFor(
    target: LitTarget
  ): THREE.Data3DTexture | null {
    const entry = this.#textures.get(target.key);

    return entry !== undefined && sameCoord(entry.origin, target.origin) ?
      entry.texture :
      this.rebuild(target);
  }

  affects(
    target: LitTarget,
    changed: ReadonlySet<LightChunkKey>
  ): boolean {
    const { x, y, z } = target.origin;

    return this.#field.overlaps(x - 1, y - 1, z - 1, this.span, changed);
  }

  rebuild(
    target: LitTarget
  ): THREE.Data3DTexture | null {
    const { span } = this;
    const { x, y, z } = target.origin;
    if (!this.#field.isLit(x - 1, y - 1, z - 1, span)) {
      this.release(target.key);

      return null;
    }

    let entry = this.#textures.get(target.key);
    if (entry === undefined) {
      const texels = new Uint32Array(span * span * span);
      const texture = new THREE.Data3DTexture(
        new Uint8Array(texels.buffer),
        span,
        span,
        span
      );
      texture.name = `voxel_light_${target.key}`;
      texture.format = THREE.RGBAFormat;
      texture.type = THREE.UnsignedByteType;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.unpackAlignment = kTexelBytes;
      texture.generateMipmaps = false;
      entry = {
        texture,
        texels,
        origin: { ...target.origin }
      };
      this.#textures.set(target.key, entry);
    }

    entry.origin = { ...target.origin };
    this.#write(target.origin, entry.texels);
    entry.texture.needsUpdate = true;

    return entry.texture;
  }

  release(
    key: string
  ): void {
    this.#textures.get(key)?.texture.dispose();
    this.#textures.delete(key);
  }

  clear(): void {
    for (const { texture } of this.#textures.values()) {
      texture.dispose();
    }
    this.#textures.clear();
  }

  #write(
    origin: Readonly<VoxelCoord>,
    texels: Uint32Array
  ): void {
    const { span } = this;
    if (this.#cells.length !== texels.length) {
      this.#cells = new Uint16Array(texels.length);
    }
    const cells = this.#cells;
    const { falloff } = this.#sources;
    this.#field.copyBox(origin.x - 1, origin.y - 1, origin.z - 1, span, cells);

    for (let i = 0; i < cells.length; i++) {
      texels[i] = falloff.texelOf(cells[i]);
    }
  }
}

function sameCoord(
  a: Readonly<VoxelCoord>,
  b: Readonly<VoxelCoord>
): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
