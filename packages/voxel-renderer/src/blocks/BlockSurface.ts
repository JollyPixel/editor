export type BlockAlphaMode = "opaque" | "mask" | "blend";
export type BlockSide = "front" | "double";

export interface BlockSurfaceOptions {
  alphaMode?: BlockAlphaMode;
  side?: BlockSide;
  alphaCutoff?: number;
  /**
   * Gives the block its own chunk material, shared by every block naming the
   * same group; the material customizer reads it from the surface.
   */
  materialGroup?: string;
}

/**
 * Resolved rendering policy, independent of neighbour-face culling.
 */
export class BlockSurface {
  readonly alphaMode: BlockAlphaMode;
  readonly side: BlockSide;
  readonly alphaCutoff: number;
  readonly materialGroup?: string;

  constructor(
    options: BlockSurfaceOptions = {}
  ) {
    const alphaMode = options.alphaMode ?? "opaque";
    const side = options.side ?? (alphaMode === "opaque" ? "front" : "double");
    const alphaCutoff = options.alphaCutoff ?? 0.1;
    if (!["opaque", "mask", "blend"].includes(alphaMode)) {
      throw new RangeError(`Unknown alpha mode: ${alphaMode}`);
    }

    if (
      side !== "front" &&
      side !== "double"
    ) {
      throw new RangeError(`Unknown face side: ${side}`);
    }

    if (
      !Number.isFinite(alphaCutoff) ||
      alphaCutoff < 0 ||
      alphaCutoff > 1
    ) {
      throw new RangeError("Alpha cutoff must be between 0 and 1.");
    }

    const { materialGroup } = options;
    if (
      materialGroup !== undefined &&
      (typeof materialGroup !== "string" || materialGroup === "")
    ) {
      throw new RangeError("Material group must be a non-empty string.");
    }

    this.alphaMode = alphaMode;
    this.side = side;
    this.alphaCutoff = alphaMode === "mask" ? alphaCutoff : 0;
    this.materialGroup = materialGroup;
    Object.freeze(this);
  }

  get occludes(): boolean {
    return this.alphaMode === "opaque";
  }
}
