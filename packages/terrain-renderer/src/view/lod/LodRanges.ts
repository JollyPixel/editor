// CONSTANTS
export const LEAF_NODE_SIZE = 32;
export const LOD_LEVELS = 6;
export const REGION_SIZE = LEAF_NODE_SIZE * 2 ** (LOD_LEVELS - 1);

export interface LodRangesOptions {
  /**
   * Distance in metres within which leaves are drawn; each coarser level
   * doubles it. At least twice the leaf size.
   * @default 80
   */
  leafRange?: number;
  /**
   * Fraction of each level's distance band, at its far end, over which
   * vertices morph toward the coarser level. Between 0 and 1, exclusive.
   * @default 0.3
   */
  morphRatio?: number;
}

export class LodRanges {
  readonly leafRange: number;
  readonly morphRatio: number;

  constructor(
    options: LodRangesOptions = {}
  ) {
    const {
      leafRange = 80,
      morphRatio = 0.3
    } = options;
    if (!(leafRange >= LEAF_NODE_SIZE * 2)) {
      throw new RangeError(`leafRange must be at least ${LEAF_NODE_SIZE * 2} m, got ${leafRange}.`);
    }
    if (!(morphRatio > 0 && morphRatio < 1)) {
      throw new RangeError(`morphRatio must lie in (0, 1), got ${morphRatio}.`);
    }

    this.leafRange = leafRange;
    this.morphRatio = morphRatio;
  }

  get rootLevel(): number {
    return LOD_LEVELS - 1;
  }

  nodeSize(
    level: number
  ): number {
    return LEAF_NODE_SIZE * 2 ** level;
  }

  range(
    level: number
  ): number {
    return this.leafRange * 2 ** level;
  }

  morphStart(
    level: number
  ): number {
    const near = level === 0 ? 0 : this.range(level - 1);

    return near + (this.range(level) - near) * (1 - this.morphRatio);
  }

  morphEnd(
    level: number
  ): number {
    return this.range(level);
  }
}
