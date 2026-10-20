// Import Third-party Dependencies
import {
  ChunkCoord,
  HEIGHT_RANGE,
  isValidHeight,
  TerrainDocument,
  TILE_SAMPLE_COUNT,
  TileCoord,
  type TerrainReader,
  type TileKey,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  TerrainChange,
  TerrainCommandDocument
} from "./TerrainCommandDocument.ts";

export type TerrainPreviewEvents = {
  tilesChanged: (tiles: readonly TileCoord[]) => void;
  chunkAdded: (coord: ChunkCoord) => void;
  chunkRemoved: (coord: ChunkCoord) => void;
  reset: () => void;
  strokeWritten: (patches: readonly TilePatch[]) => void;
  strokeSettled: (tiles: readonly TileCoord[]) => void;
};

export interface TerrainStroke {
  readonly terrain: TerrainReader;
  readonly ended: boolean;
  write(patches: Iterable<TilePatch>): void;
  commit(): boolean;
  end(): boolean;
  cancel(): void;
}

type LayerOwner = string | symbol;

interface PreviewTile {
  readonly patch: TilePatch;
  readonly order: number;
}

interface ActiveStroke {
  readonly owner: symbol;
  readonly terrain: TerrainDocument;
}

interface StrokeControls {
  readonly active: () => boolean;
  readonly write: (patches: Iterable<TilePatch>) => void;
  readonly commit: () => boolean;
  readonly finish: (commit: boolean) => boolean;
}

export class TerrainPreview extends Emitter<TerrainPreviewEvents> {
  readonly terrain: TerrainReader;

  #document: TerrainCommandDocument;
  #displayed = new TerrainDocument();
  #layers = new Map<LayerOwner, Map<TileKey, PreviewTile>>();
  #stroke: ActiveStroke | null = null;
  #writes = 0;
  #disposed = false;

  #onChange = (
    { command }: TerrainChange
  ): void => {
    switch (command.action) {
      case "chunk-added": {
        const coord = new ChunkCoord(command.x, command.z);
        const confirmed = this.#document.terrain.chunk(coord);
        if (confirmed === undefined) {
          break;
        }
        for (const terrain of this.#terrains()) {
          if (!terrain.has(coord)) {
            terrain.addChunk(coord, confirmed.copyHeights());
          }
        }
        this.emit("chunkAdded", coord);
        break;
      }
      case "chunk-removed": {
        const coord = new ChunkCoord(command.x, command.z);
        const settled = this.#forget(({ tile }) => tile.chunk.equals(coord));
        for (const terrain of this.#terrains()) {
          terrain.removeChunk(coord);
        }
        this.#strokeSettled(settled);
        this.emit("chunkRemoved", coord);
        break;
      }
      case "heights-patched": {
        const tiles = command.tiles.map(
          ({ x, z, tile }) => TileCoord.fromIndex(new ChunkCoord(x, z), tile)
        );
        const keys = new Set(tiles.map(({ key }) => key));
        const settled = this.#forget(({ tile }) => keys.has(tile.key));
        if (this.#stroke !== null) {
          this.#restore(this.#stroke.terrain, tiles);
        }
        this.#refresh(tiles);
        this.#strokeSettled(settled);
        break;
      }
    }
  };

  #onReset = (): void => {
    const settled = this.#forget(
      ({ tile }) => !this.#document.terrain.has(tile.chunk)
    );
    for (const terrain of this.#terrains()) {
      this.#mirror(terrain);
    }
    const surviving = [...this.#layers].flatMap(([owner, layer]) => Array.from(
      layer.values(),
      (tile) => {
        return { owner, tile };
      }
    ));
    surviving.sort((left, right) => left.tile.order - right.tile.order);
    for (const { owner, tile: { patch } } of surviving) {
      this.#displayed.writeTile(patch.tile, patch.heights);
      this.#strokeTerrain(owner)?.writeTile(patch.tile, patch.heights);
    }
    this.#strokeSettled(settled);
    this.emit("reset");
  };

  constructor(
    document: TerrainCommandDocument
  ) {
    super();

    this.terrain = this.#displayed;
    this.#document = document;
    this.#mirror(this.#displayed);
    document.on("change", this.#onChange);
    document.on("reset", this.#onReset);
  }

  write(
    peerId: string,
    patches: Iterable<TilePatch>
  ): void {
    if (!this.#disposed) {
      this.#write(peerId, patches);
    }
  }

  drop(
    peerId: string
  ): void {
    if (!this.#disposed) {
      this.#drop(peerId);
    }
  }

  beginStroke(): TerrainStroke {
    if (this.#stroke !== null) {
      throw new Error("A local stroke is already in progress: end or cancel it first.");
    }

    const owner = Symbol("stroke");
    const terrain = new TerrainDocument();
    this.#mirror(terrain);
    if (!this.#disposed) {
      this.#stroke = {
        owner,
        terrain
      };
    }

    return new LocalStroke(terrain, {
      active: () => this.#isActive(owner),
      write: (patches) => {
        if (this.#isActive(owner)) {
          this.#write(owner, patches);
        }
      },
      commit: () => this.#isActive(owner) && this.#commit(owner),
      finish: (commit) => this.#finish(owner, commit)
    });
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    if (this.#stroke !== null) {
      this.#finish(this.#stroke.owner, true);
    }
    this.#disposed = true;
    this.#document.off("change", this.#onChange);
    this.#document.off("reset", this.#onReset);
    this.#layers.clear();
    this.removeAllListeners();
  }

  * #terrains(): IterableIterator<TerrainDocument> {
    yield this.#displayed;
    if (this.#stroke !== null) {
      yield this.#stroke.terrain;
    }
  }

  #mirror(
    terrain: TerrainDocument
  ): void {
    terrain.clear();
    for (const chunk of this.#document.terrain.chunks()) {
      terrain.addChunk(chunk.coord, chunk.copyHeights());
    }
  }

  #isActive(
    owner: symbol
  ): boolean {
    return !this.#disposed && this.#stroke?.owner === owner;
  }

  #strokeTerrain(
    owner: LayerOwner
  ): TerrainDocument | undefined {
    return this.#stroke?.owner === owner ? this.#stroke.terrain : undefined;
  }

  #write(
    owner: LayerOwner,
    patches: Iterable<TilePatch>
  ): void {
    const accepted: TilePatch[] = [];
    for (const { tile, heights } of patches) {
      if (heights.length !== TILE_SAMPLE_COUNT || !heights.every(isValidHeight)) {
        throw new RangeError(
          `Tile ${tile.key} needs ${TILE_SAMPLE_COUNT} finite heights within ` +
          `[${HEIGHT_RANGE.min}, ${HEIGHT_RANGE.max}].`
        );
      }
      if (this.#displayed.has(tile.chunk)) {
        accepted.push({
          tile,
          heights: heights.slice()
        });
      }
    }
    if (accepted.length === 0) {
      return;
    }

    const layer = this.#layers.get(owner) ?? new Map<TileKey, PreviewTile>();
    const stroke = this.#strokeTerrain(owner);
    for (const patch of accepted) {
      this.#displayed.writeTile(patch.tile, patch.heights);
      stroke?.writeTile(patch.tile, patch.heights);
      layer.set(patch.tile.key, {
        patch,
        order: ++this.#writes
      });
    }
    this.#layers.set(owner, layer);
    this.emit("tilesChanged", accepted.map(({ tile }) => tile));
    if (stroke !== undefined) {
      this.emit("strokeWritten", accepted);
    }
  }

  #drop(
    owner: LayerOwner
  ): void {
    const tiles = this.#takeLayer(owner);
    this.#refresh(tiles);
    if (this.#strokeTerrain(owner) !== undefined) {
      this.#strokeSettled(tiles);
    }
  }

  #commit(
    owner: symbol
  ): boolean {
    const layer = this.#layers.get(owner);
    if (layer === undefined) {
      return false;
    }

    const patches = Array.from(layer.values(), ({ patch }) => patch);
    const tiles = this.#takeLayer(owner);
    const committed = this.#document.patchTiles(patches);
    if (!committed) {
      this.#refresh(tiles);
    }
    this.#strokeSettled(tiles);

    return committed;
  }

  #finish(
    owner: symbol,
    commit: boolean
  ): boolean {
    if (!this.#isActive(owner)) {
      return false;
    }

    let committed = false;
    if (commit) {
      committed = this.#commit(owner);
    }
    else {
      this.#drop(owner);
    }
    this.#stroke = null;

    return committed;
  }

  #takeLayer(
    owner: LayerOwner
  ): TileCoord[] {
    const layer = this.#layers.get(owner);
    if (layer === undefined) {
      return [];
    }

    this.#layers.delete(owner);
    const tiles = Array.from(layer.values(), ({ patch }) => patch.tile);
    const stroke = this.#strokeTerrain(owner);
    if (stroke !== undefined) {
      this.#restore(stroke, tiles);
    }

    return tiles;
  }

  #forget(
    covers: (patch: TilePatch) => boolean
  ): TileCoord[] {
    const strokeSettled: TileCoord[] = [];
    for (const [owner, layer] of this.#layers) {
      for (const [key, { patch }] of layer) {
        if (covers(patch)) {
          layer.delete(key);
          if (this.#strokeTerrain(owner) !== undefined) {
            strokeSettled.push(patch.tile);
          }
        }
      }
      if (layer.size === 0) {
        this.#layers.delete(owner);
      }
    }

    return strokeSettled;
  }

  #strokeSettled(
    tiles: readonly TileCoord[]
  ): void {
    if (tiles.length > 0) {
      this.emit("strokeSettled", tiles);
    }
  }

  #restore(
    terrain: TerrainDocument,
    tiles: readonly TileCoord[],
    previewAt: (key: TileKey) => PreviewTile | undefined = () => undefined
  ): TileCoord[] {
    const changed: TileCoord[] = [];
    for (const tile of tiles) {
      const shown = terrain.chunk(tile.chunk);
      const confirmed = this.#document.terrain.chunk(tile.chunk);
      if (shown === undefined || confirmed === undefined) {
        continue;
      }

      const heights = previewAt(tile.key)?.patch.heights ??
        confirmed.tileHeights(tile.x, tile.z);
      if (!sameHeights(shown.tileHeights(tile.x, tile.z), heights)) {
        terrain.writeTile(tile, heights);
        changed.push(tile);
      }
    }

    return changed;
  }

  #refresh(
    tiles: readonly TileCoord[]
  ): void {
    const changed = this.#restore(
      this.#displayed,
      tiles,
      (key) => this.#topPreview(key)
    );
    if (changed.length > 0) {
      this.emit("tilesChanged", changed);
    }
  }

  #topPreview(
    key: TileKey
  ): PreviewTile | undefined {
    let top: PreviewTile | undefined;
    for (const layer of this.#layers.values()) {
      const tile = layer.get(key);
      if (tile !== undefined && (top === undefined || tile.order > top.order)) {
        top = tile;
      }
    }

    return top;
  }
}

class LocalStroke implements TerrainStroke {
  readonly terrain: TerrainReader;

  #controls: StrokeControls;

  constructor(
    terrain: TerrainReader,
    controls: StrokeControls
  ) {
    this.terrain = terrain;
    this.#controls = controls;
  }

  get ended(): boolean {
    return !this.#controls.active();
  }

  write(
    patches: Iterable<TilePatch>
  ): void {
    this.#controls.write(patches);
  }

  commit(): boolean {
    return this.#controls.commit();
  }

  end(): boolean {
    return this.#controls.finish(true);
  }

  cancel(): void {
    this.#controls.finish(false);
  }
}

function sameHeights(
  left: Float32Array,
  right: Float32Array
): boolean {
  return left.length === right.length &&
    left.every((height, index) => height === right[index]);
}
