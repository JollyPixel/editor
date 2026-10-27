// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
export const MATERIAL_MAPS = ["albedo", "normal", "orm", "height"] as const;
export const MATERIAL_SLOT_COUNT = 256;
export const DEFAULT_MATERIAL_TEXTURE_SIZE = 1024;
export const MATERIAL_MAP_BITS: Readonly<Record<MaterialMap, number>> = {
  albedo: 1,
  normal: 2,
  orm: 4,
  height: 8
};
export const MATERIAL_TECHNIQUES = ["triplanar", "stochastic", "heightBlend"] as const;
export const MATERIAL_TECHNIQUE_BITS: Readonly<Record<MaterialTechnique, number>> = {
  triplanar: 1,
  stochastic: 2,
  heightBlend: 4
};
const kInitialCapacity = 4;
const kSlotComponents = 4;
const kIndexComponent = 0;
const kTilingComponent = 1;
const kMapsComponent = 2;
const kTechniquesComponent = 3;

export type MaterialMap = typeof MATERIAL_MAPS[number];
export type MaterialTechnique = typeof MATERIAL_TECHNIQUES[number];

export interface MaterialSurface {
  /**
   * Metres per repeat of the material's maps.
   */
  tiling: number;
  /**
   * Projects the maps from three sides on steep slopes.
   */
  triplanar?: boolean;
  /**
   * Samples each repeat with a random offset, so the tiling does not show.
   */
  stochastic?: boolean;
  /**
   * Blends with the other materials along the height map.
   */
  heightBlend?: boolean;
}

export interface MaterialImage {
  readonly width: number;
  readonly height: number;
}

export interface TextureCopier {
  copyTextureToTexture(
    source: THREE.Texture,
    destination: THREE.Texture,
    sourceRegion?: THREE.Box3 | null,
    destinationPosition?: THREE.Vector3 | null
  ): void;
}

export type MaterialArrays = Readonly<Record<MaterialMap, THREE.DataArrayTexture>>;

export interface MaterialTextureStoreOptions {
  copier: TextureCopier | null;
  /**
   * Called after the arrays were replaced by larger or resized ones.
   */
  replaced?: (arrays: MaterialArrays) => void;
}

export class MaterialTextureStore {
  readonly slots: THREE.DataTexture;

  #arrays: MaterialArrays;
  #size = DEFAULT_MATERIAL_TEXTURE_SIZE;
  #capacity = kInitialCapacity;
  #copier: TextureCopier | null;
  #replaced: (arrays: MaterialArrays) => void;
  #indices = new Map<number, number>();

  constructor(
    options: MaterialTextureStoreOptions
  ) {
    this.#copier = options.copier;
    this.#replaced = options.replaced ?? (() => undefined);
    this.slots = new THREE.DataTexture(
      new Float32Array(MATERIAL_SLOT_COUNT * kSlotComponents),
      MATERIAL_SLOT_COUNT,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.slots.minFilter = THREE.NearestFilter;
    this.slots.magFilter = THREE.NearestFilter;
    this.slots.generateMipmaps = false;
    this.#arrays = createArrays(this.#size, this.#capacity);
  }

  get arrays(): MaterialArrays {
    return this.#arrays;
  }

  get size(): number {
    return this.#size;
  }

  get capacity(): number {
    return this.#capacity;
  }

  index(
    slot: number
  ): number | undefined {
    return this.#indices.get(slot);
  }

  hasMap(
    slot: number,
    map: MaterialMap
  ): boolean {
    const maps = this.#slotData()[slot * kSlotComponents + kMapsComponent];

    return (maps & MATERIAL_MAP_BITS[map]) !== 0;
  }

  materialChanged(
    slot: number,
    surface: MaterialSurface
  ): void {
    assertSlot(slot);
    let index = this.#indices.get(slot);
    if (index === undefined) {
      index = this.#freeIndex();
      this.#indices.set(slot, index);
      this.#writeSlot(slot, kIndexComponent, index + 1);
      this.#writeSlot(slot, kMapsComponent, 0);
    }
    this.#writeSlot(slot, kTilingComponent, surface.tiling);
    this.#writeSlot(slot, kTechniquesComponent, MATERIAL_TECHNIQUES.reduce(
      (bits, technique) => (surface[technique] === true ? bits | MATERIAL_TECHNIQUE_BITS[technique] : bits),
      0
    ));
  }

  materialRemoved(
    slot: number
  ): void {
    if (this.#indices.delete(slot)) {
      this.#slotData().fill(0, slot * kSlotComponents, (slot + 1) * kSlotComponents);
      this.slots.needsUpdate = true;
    }
  }

  writeMap(
    slot: number,
    map: MaterialMap,
    image: MaterialImage | null
  ): void {
    const index = this.#indices.get(slot);
    if (index === undefined) {
      throw new RangeError(`Terrain material slot ${slot} has no material.`);
    }

    const maps = this.#slotData()[slot * kSlotComponents + kMapsComponent];
    if (image === null || this.#copier === null) {
      this.#writeSlot(slot, kMapsComponent, maps & ~MATERIAL_MAP_BITS[map]);

      return;
    }
    if (image.width !== this.#size || image.height !== this.#size) {
      throw new RangeError(
        `A terrain material image must be ${this.#size}×${this.#size}, not ${image.width}×${image.height}.`
      );
    }

    const source = new THREE.Texture(image as THREE.Texture["image"]);
    source.colorSpace = this.#arrays[map].colorSpace;
    source.generateMipmaps = false;
    source.needsUpdate = true;
    this.#copier.copyTextureToTexture(
      source,
      this.#arrays[map],
      null,
      new THREE.Vector3(0, 0, index)
    );
    source.dispose();
    this.#writeSlot(slot, kMapsComponent, maps | MATERIAL_MAP_BITS[map]);
  }

  resize(
    size: number
  ): void {
    if (size === this.#size) {
      return;
    }

    this.#size = size;
    this.#replace(createArrays(size, this.#capacity), false);
    const data = this.#slotData();
    for (const slot of this.#indices.keys()) {
      data[slot * kSlotComponents + kMapsComponent] = 0;
    }
    this.slots.needsUpdate = true;
  }

  clear(): void {
    this.#indices.clear();
    this.#slotData().fill(0);
    this.slots.needsUpdate = true;
  }

  dispose(): void {
    this.slots.dispose();
    for (const array of Object.values(this.#arrays)) {
      array.dispose();
    }
  }

  #freeIndex(): number {
    const used = new Set(this.#indices.values());
    for (let index = 0; index < this.#capacity; index++) {
      if (!used.has(index)) {
        return index;
      }
    }

    const index = this.#capacity;
    this.#capacity *= 2;
    this.#replace(createArrays(this.#size, this.#capacity), true);

    return index;
  }

  #replace(
    arrays: MaterialArrays,
    keepMaterials: boolean
  ): void {
    const previous = this.#arrays;
    if (keepMaterials && this.#copier !== null) {
      const region = new THREE.Box3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(this.#size, this.#size, previous.albedo.image.depth)
      );
      for (const map of MATERIAL_MAPS) {
        this.#copier.copyTextureToTexture(previous[map], arrays[map], region, new THREE.Vector3(0, 0, 0));
      }
    }
    this.#arrays = arrays;
    for (const array of Object.values(previous)) {
      array.dispose();
    }
    this.#replaced(arrays);
  }

  #slotData(): Float32Array {
    return this.slots.image.data as Float32Array;
  }

  #writeSlot(
    slot: number,
    component: number,
    value: number
  ): void {
    this.#slotData()[slot * kSlotComponents + component] = value;
    this.slots.needsUpdate = true;
  }
}

function assertSlot(
  slot: number
): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MATERIAL_SLOT_COUNT) {
    throw new RangeError(`A terrain material slot lies in [0, ${MATERIAL_SLOT_COUNT}), not ${slot}.`);
  }
}

function createArrays(
  size: number,
  depth: number
): MaterialArrays {
  return {
    albedo: createArray(size, depth, THREE.SRGBColorSpace),
    normal: createArray(size, depth, THREE.NoColorSpace),
    orm: createArray(size, depth, THREE.NoColorSpace),
    height: createArray(size, depth, THREE.NoColorSpace)
  };
}

function createArray(
  size: number,
  depth: number,
  colorSpace: string
): THREE.DataArrayTexture {
  const array = new THREE.DataArrayTexture(null, size, size, depth);
  array.format = THREE.RGBAFormat;
  array.type = THREE.UnsignedByteType;
  array.colorSpace = colorSpace;
  array.wrapS = THREE.RepeatWrapping;
  array.wrapT = THREE.RepeatWrapping;
  array.minFilter = THREE.LinearMipmapLinearFilter;
  array.magFilter = THREE.LinearFilter;
  array.generateMipmaps = true;
  array.anisotropy = 4;
  array.source.dataReady = false;
  array.needsUpdate = true;

  return array;
}
