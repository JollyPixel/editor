// Import Internal Dependencies
import type {
  ResolvedTileRef,
  TileSpan
} from "../tilesets/types.ts";
import {
  rescaleTileRef,
  UNIT_TILE_SPAN,
  type TileRescale
} from "../tilesets/tileRef.ts";
import type { ResolvedBlockDefinition } from "./BlockDefinition.ts";
import { baseSlotOf } from "./shape/shapeSlots.ts";

export type TileRefMapper = (ref: ResolvedTileRef) => ResolvedTileRef;

export class BlockTextures implements Iterable<ResolvedTileRef> {
  static of(
    block: ResolvedBlockDefinition
  ): BlockTextures {
    return new BlockTextures(
      block.faceTextures,
      block.defaultTexture
    );
  }

  readonly faceTextures: Readonly<Record<string, ResolvedTileRef>>;
  readonly defaultTexture: ResolvedTileRef | undefined;

  constructor(
    faceTextures: Readonly<Record<string, ResolvedTileRef>>,
    defaultTexture?: ResolvedTileRef
  ) {
    this.faceTextures = faceTextures;
    this.defaultTexture = defaultTexture;

    Object.freeze(this);
  }

  * [Symbol.iterator](): IterableIterator<ResolvedTileRef> {
    yield* Object.values(this.faceTextures);
    if (this.defaultTexture !== undefined) {
      yield this.defaultTexture;
    }
  }

  get size(): number | undefined {
    return (this.defaultTexture ?? [...this][0])?.size;
  }

  forSlot(
    slot: string
  ): ResolvedTileRef | undefined {
    return this.faceTextures[slot] ??
      this.faceTextures[baseSlotOf(slot)] ??
      this.defaultTexture;
  }

  spanFor(
    slot: string,
    span: Readonly<TileSpan>
  ): Readonly<TileSpan> {
    const ownsTile = this.faceTextures[slot] !== undefined ||
      this.faceTextures[baseSlotOf(slot)] !== undefined;

    return ownsTile ? span : UNIT_TILE_SPAN;
  }

  tilesetIds(): string[] {
    const ids = new Set<string>();
    for (const ref of this) {
      if (ref.tilesetId !== undefined) {
        ids.add(ref.tilesetId);
      }
    }

    return [...ids];
  }

  map(
    mapper: TileRefMapper
  ): BlockTextures {
    let changed = false;
    const faceTextures: Record<string, ResolvedTileRef> = {};
    for (const [slot, ref] of Object.entries(this.faceTextures)) {
      const next = mapper(ref);
      changed ||= next !== ref;
      faceTextures[slot] = next;
    }

    const defaultTexture = this.defaultTexture && mapper(
      this.defaultTexture
    );
    changed ||= defaultTexture !== this.defaultTexture;

    return changed ?
      new BlockTextures(faceTextures, defaultTexture) :
      this;
  }

  withSize(
    size: number
  ): BlockTextures {
    return this.map((ref) => {
      return {
        ...ref,
        size
      };
    });
  }

  staysOnGrid(
    rescale: TileRescale
  ): boolean {
    return [...this].every((ref) => {
      const moved = rescaleTileRef(ref, rescale);

      return Number.isInteger(moved.col) && Number.isInteger(moved.row);
    });
  }

  withTileset(
    tilesetId: string | null
  ): BlockTextures {
    if (tilesetId === null) {
      return this;
    }

    return this.map((ref) => (
      ref.tilesetId === undefined ?
        {
          ...ref,
          tilesetId
        } :
        ref
    ));
  }

  applyTo(
    block: ResolvedBlockDefinition
  ): ResolvedBlockDefinition {
    if (
      this.faceTextures === block.faceTextures &&
      this.defaultTexture === block.defaultTexture
    ) {
      return block;
    }

    const {
      defaultTexture: _defaultTexture,
      ...rest
    } = block;
    const applied: ResolvedBlockDefinition = {
      ...rest,
      faceTextures: { ...this.faceTextures }
    };
    if (this.defaultTexture !== undefined) {
      applied.defaultTexture = this.defaultTexture;
    }

    return applied;
  }
}
