// Import Third-party Dependencies
import {
  chunksInRect,
  MAX_EXCHANGE_IMAGE_SIDE,
  readHeightGrid,
  readSplatMasks,
  type ChunkContents,
  type SplatMask,
  type TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  chunkResolution,
  decodePng,
  decodeRaw,
  encodePng,
  encodeRaw,
  expandHeights,
  fitGrid,
  InvalidImageError,
  parseHeightmapSidecar,
  quantizeHeights,
  SPLAT_TEXELS,
  type ChunkRect,
  type ChunkTier,
  type GrayImage,
  type HeightmapSidecar,
  type HeightRange
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";

// CONSTANTS
const kRefusals: Readonly<Record<NonNullable<ReturnType<TerrainDocument["importRefusal"]>>, string>> = {
  "out-of-range": "The rectangle leaves the terrain's coordinates, -128 to 127.",
  "too-many-chunks": "The chunks this adds would pass the limit of 4096.",
  disconnected: "The rectangle must touch the terrain to add chunks."
};

export type HeightmapFormat = "png" | "raw";

export interface ExchangeFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface ChosenHeightmap {
  readonly image: GrayImage;
  readonly sidecar: HeightmapSidecar | null;
}

export interface ChosenMask {
  readonly name: string;
  readonly image: GrayImage;
  readonly slot: number | null;
}

export interface TerrainExchangeOptions {
  document: Pick<
    TerrainDocument,
    "terrain" | "materials" | "stream" | "importRefusal" | "importHeights" | "importSplat"
  >;
  history: Pick<TerrainHistory, "record">;
  baseName: string;
}

export class TerrainExchange {
  #options: TerrainExchangeOptions;

  constructor(
    options: TerrainExchangeOptions
  ) {
    this.#options = options;
  }

  wholeRect(): ChunkRect {
    const coords = [...this.#options.document.terrain.overview.coords()];
    const xs = coords.map(({ x }) => x);
    const zs = coords.map(({ z }) => z);
    const x = Math.min(...xs);
    const z = Math.min(...zs);

    return {
      x,
      z,
      columns: Math.max(...xs) - x + 1,
      rows: Math.max(...zs) - z + 1
    };
  }

  async exportHeightmap(
    rect: ChunkRect,
    tier: ChunkTier,
    format: HeightmapFormat
  ): Promise<ExchangeFile[]> {
    assertImageSide(rect, chunkResolution(tier));
    const grid = await readHeightGrid(this.#read(rect), rect, tier);
    if (grid === null) {
      throw new InvalidImageError("The rectangle holds no chunk.");
    }

    const { width, height, range } = grid;
    const image: GrayImage = {
      width,
      height,
      depth: 16,
      samples: quantizeHeights(grid.heights, range)
    };
    const sidecar: HeightmapSidecar = { ...range, width, height, tier, rect };
    const { baseName } = this.#options;

    return [
      {
        name: `${baseName}.${format === "png" ? "png" : "r16"}`,
        bytes: format === "png" ? await encodePng(image) : encodeRaw(image)
      },
      {
        name: `${baseName}.json`,
        bytes: new TextEncoder().encode(JSON.stringify(sidecar, null, 2))
      }
    ];
  }

  async exportSplat(
    rect: ChunkRect
  ): Promise<ExchangeFile[]> {
    assertImageSide(rect, SPLAT_TEXELS);
    const { document, baseName } = this.#options;
    const masks = await readSplatMasks(this.#read(rect), rect);

    return Promise.all(masks.map(async({ slot, image }) => {
      const material = document.materials.materialAt(slot)?.name ?? `slot-${slot}`;

      return { name: `${baseName}_${fileWord(material)}.png`, bytes: await encodePng(image) };
    }));
  }

  async chooseHeightmap(
    files: readonly ExchangeFile[]
  ): Promise<ChosenHeightmap> {
    const sidecarFile = files.find(({ name }) => name.toLowerCase().endsWith(".json"));
    const imageFile = files.find((file) => file !== sidecarFile);
    if (imageFile === undefined) {
      throw new InvalidImageError("Choose a PNG or RAW heightmap with the sidecar.");
    }

    const sidecar = sidecarFile === undefined ?
      null :
      parseHeightmapSidecar(new TextDecoder().decode(sidecarFile.bytes));
    if (sidecarFile !== undefined && sidecar === null) {
      throw new InvalidImageError(`${sidecarFile.name} is not a heightmap sidecar.`);
    }

    return {
      image: imageFile.name.toLowerCase().endsWith(".png") ?
        await decodePng(imageFile.bytes) :
        decodeRaw(imageFile.bytes, sidecar ?? undefined),
      sidecar
    };
  }

  chooseMasks(
    files: readonly ExchangeFile[]
  ): Promise<ChosenMask[]> {
    return Promise.all(files.map(async({ name, bytes }) => {
      return { name, image: await decodePng(bytes), slot: this.#matchMaterial(name) };
    }));
  }

  refusal(
    rect: ChunkRect
  ): string | null {
    const refusal = this.#options.document.importRefusal(rect);

    return refusal === null ? null : kRefusals[refusal];
  }

  async importHeightmap(
    image: GrayImage,
    rect: ChunkRect,
    tier: ChunkTier,
    range: HeightRange
  ): Promise<boolean> {
    const { document, history } = this.#options;
    const resolution = chunkResolution(tier);
    const size = { width: rect.columns * resolution, height: rect.rows * resolution };
    const heights = fitGrid(expandHeights(image, range), image, size);
    const before = await this.#readAll(rect);

    return history.record(
      TERRAIN_HISTORY_SCOPE,
      "Import heightmap",
      () => document.importHeights(rect, tier, heights, before)
    );
  }

  async importSplat(
    rect: ChunkRect,
    masks: readonly SplatMask[]
  ): Promise<boolean> {
    const { document, history } = this.#options;
    const before = await this.#readAll(rect);

    return history.record(
      TERRAIN_HISTORY_SCOPE,
      "Import splat map",
      () => document.importSplat(rect, masks, before)
    );
  }

  #read(
    rect: ChunkRect
  ): AsyncIterable<ChunkContents> {
    return this.#options.document.stream.read(chunksInRect(rect));
  }

  async #readAll(
    rect: ChunkRect
  ): Promise<ChunkContents[]> {
    const contents: ChunkContents[] = [];
    for await (const chunk of this.#read(rect)) {
      contents.push(chunk);
    }

    return contents;
  }

  #matchMaterial(
    fileName: string
  ): number | null {
    const stem = fileWord(fileName.replace(/\.[^.]*$/, ""));
    const matches = this.#options.document.materials.materials()
      .filter(({ name }) => stem === fileWord(name) || stem.endsWith(`_${fileWord(name)}`))
      .sort((left, right) => right.name.length - left.name.length);

    return matches[0]?.slot ?? null;
  }
}

function assertImageSide(
  { columns, rows }: ChunkRect,
  resolution: number
): void {
  if (Math.max(columns, rows) * resolution > MAX_EXCHANGE_IMAGE_SIDE) {
    throw new InvalidImageError(
      `An image side stops at ${MAX_EXCHANGE_IMAGE_SIDE} px: pick a smaller rectangle or a lower detail.`
    );
  }
}

function fileWord(
  name: string
): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "-");
}
