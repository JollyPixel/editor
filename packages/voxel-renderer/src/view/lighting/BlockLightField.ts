// Import Internal Dependencies
import type { VoxelWorld } from "../../document/world/VoxelWorld.ts";
import { MAX_LIGHT_LEVEL } from "../../document/materials/MaterialGroup.ts";
import type { MeshableLayerVisibility } from "../meshing/types.ts";
import type { BlockLightSources } from "./BlockLightSources.ts";
import {
  LightCellScan,
  type LightCells
} from "./LightCellScan.ts";
import { LightChanges } from "./LightChanges.ts";
import {
  LightGrid,
  lightChunkCoords,
  lightChunkKey,
  type LightChunkKey
} from "./LightGrid.ts";
import { LightQueue } from "./LightQueue.ts";
import {
  brightestLight,
  dimLight,
  LIGHT_OPAQUE
} from "./packedLight.ts";

// CONSTANTS
const kNoChanges: ReadonlySet<LightChunkKey> = new Set();
const kNeighbours: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];

export interface BlockLightFieldOptions {
  world: VoxelWorld;
  sources: BlockLightSources;
  visibility: MeshableLayerVisibility;
}

interface LightBox {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly span: number;
  readonly target: Uint16Array;
}

interface LightChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  levels: Uint16Array | null;
  cells: LightCells | null;
  pass: number;
}

export class BlockLightField {
  readonly grid: LightGrid;

  #sources: BlockLightSources;
  #scan: LightCellScan;
  #changes: LightChanges;
  #reach: number;
  #chunks = new Map<LightChunkKey, LightChunk>();
  #stale = true;
  #repainted = false;
  #pass = 0;
  #queue = new LightQueue();
  #lastKey = Number.NaN;
  #lastChunk: LightChunk | undefined = undefined;

  constructor(
    options: BlockLightFieldOptions
  ) {
    const { world, sources, visibility } = options;

    this.grid = new LightGrid(world.chunkSize);
    this.#sources = sources;
    this.#scan = new LightCellScan({
      world,
      sources,
      visibility,
      grid: this.grid
    });
    this.#changes = new LightChanges({
      world,
      visibility,
      grid: this.grid
    });
    this.#reach = Math.ceil(MAX_LIGHT_LEVEL / this.grid.size);
  }

  invalidate(): void {
    this.#stale = true;
  }

  repaint(): void {
    this.#repainted = true;
  }

  update(): ReadonlySet<LightChunkKey> {
    if (this.#stale) {
      this.#stale = false;
      this.#repainted = false;

      return this.#relightAll();
    }

    const relit = this.#relightChanges();
    if (!this.#repainted) {
      return relit;
    }

    this.#repainted = false;
    const changed = this.#litKeys();
    for (const key of relit) {
      changed.add(key);
    }

    return changed;
  }

  isLit(
    minX: number,
    minY: number,
    minZ: number,
    span: number
  ): boolean {
    return this.grid.someKeyCovering(
      minX,
      minY,
      minZ,
      span,
      (key) => (this.#chunks.get(key)?.levels ?? null) !== null
    );
  }

  overlaps(
    minX: number,
    minY: number,
    minZ: number,
    span: number,
    keys: ReadonlySet<LightChunkKey>
  ): boolean {
    return this.grid.someKeyCovering(
      minX,
      minY,
      minZ,
      span,
      (key) => keys.has(key)
    );
  }

  copyRow(
    x: number,
    y: number,
    z: number,
    target: Uint16Array
  ): void {
    const { shift, mask } = this.grid;
    const rowIndex = this.grid.localIndex(0, y & mask, z & mask);
    let written = 0;

    while (written < target.length) {
      const cx = (x + written) >> shift;
      const chunk = this.#resolved(cx, y >> shift, z >> shift);
      const levels = chunk.levels;
      const opaque = chunk.cells!.opaque;
      const end = Math.min(target.length, ((cx + 1) << shift) - x);
      for (; written < end; written++) {
        const index = rowIndex | ((x + written) & mask);
        const level = levels === null ? 0 : levels[index];
        target[written] = opaque[index] === 0 ? level : level | LIGHT_OPAQUE;
      }
    }
  }

  copyBox(
    minX: number,
    minY: number,
    minZ: number,
    span: number,
    target: Uint16Array
  ): void {
    const box: LightBox = {
      minX,
      minY,
      minZ,
      span,
      target
    };
    const coords = this.grid.chunksCovering(minX, minY, minZ, span);
    for (const [cx, cy, cz] of coords) {
      this.#copyOverlap(this.#resolved(cx, cy, cz), box);
    }
  }

  #copyOverlap(
    chunk: LightChunk,
    box: LightBox
  ): void {
    const { shift, mask } = this.grid;
    const { minX, minY, minZ, span, target } = box;
    const x0 = Math.max(minX, chunk.cx << shift);
    const x1 = Math.min(minX + span, (chunk.cx + 1) << shift);
    const y0 = Math.max(minY, chunk.cy << shift);
    const y1 = Math.min(minY + span, (chunk.cy + 1) << shift);
    const z0 = Math.max(minZ, chunk.cz << shift);
    const z1 = Math.min(minZ + span, (chunk.cz + 1) << shift);
    const levels = chunk.levels;
    const opaque = chunk.cells!.opaque;

    for (let z = z0; z < z1; z++) {
      for (let y = y0; y < y1; y++) {
        let index = this.grid.localIndex(x0 & mask, y & mask, z & mask);
        let offset = (x0 - minX) + (((y - minY) + ((z - minZ) * span)) * span);
        for (let x = x0; x < x1; x++) {
          const level = levels === null ? 0 : levels[index];
          target[offset++] = opaque[index] === 0 ? level : level | LIGHT_OPAQUE;
          index++;
        }
      }
    }
  }

  #relightChanges(): ReadonlySet<LightChunkKey> {
    if (!this.#sources.emits) {
      return kNoChanges;
    }

    const changed = this.#changes.collect();

    return changed.size === 0 ? kNoChanges : this.#relight(changed);
  }

  #litKeys(): Set<LightChunkKey> {
    const keys = new Set<LightChunkKey>();
    for (const [key, chunk] of this.#chunks) {
      if (chunk.levels !== null) {
        keys.add(key);
      }
    }

    return keys;
  }

  #relightAll(): Set<LightChunkKey> {
    const changed = this.#litKeys();
    this.#chunks.clear();
    this.#lastKey = Number.NaN;
    this.#lastChunk = undefined;
    this.#changes.settle();
    if (!this.#sources.emits) {
      return changed;
    }

    for (const key of this.#relight(this.#scan.emittingKeys())) {
      changed.add(key);
    }

    return changed;
  }

  #relight(
    sources: ReadonlySet<LightChunkKey>
  ): Set<LightChunkKey> {
    for (const key of sources) {
      const chunk = this.#chunks.get(key);
      if (chunk !== undefined) {
        chunk.cells = null;
      }
    }

    const keys = this.#regionAround(sources);
    if (!this.#mayBeLit(keys)) {
      return new Set();
    }

    const pass = ++this.#pass;
    const previous = new Map<LightChunk, Uint16Array | null>();
    for (const key of keys) {
      const chunk = this.#resolved(...lightChunkCoords(key));
      chunk.pass = pass;
      previous.set(chunk, chunk.levels?.slice() ?? null);
      chunk.levels?.fill(0);
    }

    for (const chunk of previous.keys()) {
      this.#seedEmitters(chunk);
    }
    for (const chunk of previous.keys()) {
      this.#seedBorders(chunk, pass);
    }
    this.#propagate(pass);

    const changed = new Set<LightChunkKey>();
    for (const [chunk, before] of previous) {
      if (chunk.levels !== null && isDark(chunk.levels)) {
        chunk.levels = null;
      }

      const key = lightChunkKey(chunk.cx, chunk.cy, chunk.cz);
      const lit = chunk.levels !== null || before !== null;
      if (lit && (sources.has(key) || !sameLevels(before, chunk.levels))) {
        changed.add(key);
      }
    }

    return changed;
  }

  #regionAround(
    sources: ReadonlySet<LightChunkKey>
  ): Set<LightChunkKey> {
    const reach = this.#reach;
    const keys = new Set<LightChunkKey>();

    for (const key of sources) {
      const [cx, cy, cz] = lightChunkCoords(key);
      for (let dz = -reach; dz <= reach; dz++) {
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            keys.add(lightChunkKey(cx + dx, cy + dy, cz + dz));
          }
        }
      }
    }

    return keys;
  }

  #mayBeLit(
    keys: ReadonlySet<LightChunkKey>
  ): boolean {
    for (const key of keys) {
      if (this.#chunks.get(key)?.levels) {
        return true;
      }
    }
    for (const key of keys) {
      if (this.#scan.emitsOver(...lightChunkCoords(key))) {
        return true;
      }
    }

    return false;
  }

  #seedEmitters(
    chunk: LightChunk
  ): void {
    const { emitters } = chunk.cells!;
    if (emitters.size === 0) {
      return;
    }

    const levels = this.#levelsOf(chunk);
    for (const [index, light] of emitters) {
      levels[index] = brightestLight(levels[index], light);
      this.#pushIndex(chunk, index);
    }
  }

  #seedBorders(
    chunk: LightChunk,
    pass: number
  ): void {
    const { size } = this.grid;
    const last = size - 1;
    const opaque = chunk.cells!.opaque;

    for (const [dx, dy, dz] of kNeighbours) {
      const outside = this.#chunks.get(
        lightChunkKey(chunk.cx + dx, chunk.cy + dy, chunk.cz + dz)
      );
      if (
        outside === undefined ||
        outside.pass === pass ||
        outside.levels === null
      ) {
        continue;
      }

      const axis = Math.abs(dy) + (2 * Math.abs(dz));
      const inner = (dx + dy + dz) > 0 ? last : 0;
      const outer = last - inner;
      const cell = [0, 0, 0];
      const from = [0, 0, 0];
      for (let b = 0; b < size; b++) {
        for (let a = 0; a < size; a++) {
          cell[axis] = inner;
          cell[(axis + 1) % 3] = a;
          cell[(axis + 2) % 3] = b;
          from[axis] = outer;
          from[(axis + 1) % 3] = a;
          from[(axis + 2) % 3] = b;

          const light = dimLight(
            outside.levels[this.grid.localIndex(from[0], from[1], from[2])]
          );
          const index = this.grid.localIndex(cell[0], cell[1], cell[2]);
          if (light === 0 || opaque[index] !== 0) {
            continue;
          }

          const levels = this.#levelsOf(chunk);
          const merged = brightestLight(levels[index], light);
          if (merged !== levels[index]) {
            levels[index] = merged;
            this.#pushIndex(chunk, index);
          }
        }
      }
    }
  }

  #propagate(
    pass: number
  ): void {
    const { shift, mask } = this.grid;
    const strideY = 1 << shift;
    const strideZ = 1 << (shift * 2);
    const queue = this.#queue;

    while (queue.next()) {
      const { x, y, z } = queue;
      const chunk = this.#chunkAt(x >> shift, y >> shift, z >> shift)!;
      const lx = x & mask;
      const ly = y & mask;
      const lz = z & mask;
      const index = lx | (ly << shift) | (lz << (shift * 2));
      const light = dimLight(chunk.levels![index]);
      if (light === 0) {
        continue;
      }

      if (lx < mask) {
        this.#spreadWithin(chunk, index + 1, light);
      }
      else {
        this.#spreadAcross(x + 1, y, z, light, pass);
      }
      if (lx > 0) {
        this.#spreadWithin(chunk, index - 1, light);
      }
      else {
        this.#spreadAcross(x - 1, y, z, light, pass);
      }
      if (ly < mask) {
        this.#spreadWithin(chunk, index + strideY, light);
      }
      else {
        this.#spreadAcross(x, y + 1, z, light, pass);
      }
      if (ly > 0) {
        this.#spreadWithin(chunk, index - strideY, light);
      }
      else {
        this.#spreadAcross(x, y - 1, z, light, pass);
      }
      if (lz < mask) {
        this.#spreadWithin(chunk, index + strideZ, light);
      }
      else {
        this.#spreadAcross(x, y, z + 1, light, pass);
      }
      if (lz > 0) {
        this.#spreadWithin(chunk, index - strideZ, light);
      }
      else {
        this.#spreadAcross(x, y, z - 1, light, pass);
      }
    }
  }

  #spreadWithin(
    chunk: LightChunk,
    index: number,
    light: number
  ): void {
    if (chunk.cells!.opaque[index] !== 0) {
      return;
    }

    const levels = chunk.levels!;
    const merged = brightestLight(levels[index], light);
    if (merged !== levels[index]) {
      levels[index] = merged;
      this.#pushIndex(chunk, index);
    }
  }

  #spreadAcross(
    x: number,
    y: number,
    z: number,
    light: number,
    pass: number
  ): void {
    const { shift, mask } = this.grid;
    const target = this.#chunkAt(x >> shift, y >> shift, z >> shift);
    if (target === undefined || target.pass !== pass) {
      return;
    }

    const index = this.grid.localIndex(x & mask, y & mask, z & mask);
    if (target.cells!.opaque[index] !== 0) {
      return;
    }

    const levels = this.#levelsOf(target);
    const merged = brightestLight(levels[index], light);
    if (merged !== levels[index]) {
      levels[index] = merged;
      this.#queue.push(x, y, z);
    }
  }

  #pushIndex(
    chunk: LightChunk,
    index: number
  ): void {
    const { size, shift, mask } = this.grid;

    this.#queue.push(
      (chunk.cx * size) + (index & mask),
      (chunk.cy * size) + ((index >> shift) & mask),
      (chunk.cz * size) + (index >> (shift * 2))
    );
  }

  #levelsOf(
    chunk: LightChunk
  ): Uint16Array {
    chunk.levels ??= new Uint16Array(this.grid.cells);

    return chunk.levels;
  }

  #chunkAt(
    cx: number,
    cy: number,
    cz: number
  ): LightChunk | undefined {
    const key = lightChunkKey(cx, cy, cz);
    if (key !== this.#lastKey) {
      this.#lastKey = key;
      this.#lastChunk = this.#chunks.get(key);
    }

    return this.#lastChunk;
  }

  #resolved(
    cx: number,
    cy: number,
    cz: number
  ): LightChunk {
    const key = lightChunkKey(cx, cy, cz);
    let chunk = this.#chunks.get(key);
    if (chunk === undefined) {
      chunk = {
        cx,
        cy,
        cz,
        levels: null,
        cells: null,
        pass: 0
      };
      this.#chunks.set(key, chunk);
      if (key === this.#lastKey) {
        this.#lastChunk = chunk;
      }
    }
    chunk.cells ??= this.#scan.cellsOf(cx, cy, cz);

    return chunk;
  }
}

function sameLevels(
  a: Uint16Array | null,
  b: Uint16Array | null
): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  const left = pairsOf(a);
  const right = pairsOf(b);
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
}

function isDark(
  levels: Uint16Array
): boolean {
  const pairs = pairsOf(levels);
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i] !== 0) {
      return false;
    }
  }

  return true;
}

function pairsOf(
  levels: Uint16Array
): Uint32Array {
  return new Uint32Array(levels.buffer, levels.byteOffset, levels.length >> 1);
}
