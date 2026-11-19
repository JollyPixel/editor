// Import Internal Dependencies
import type {
  MapVoxel,
  MapVoxelPart,
  MapVoxels
} from "./MapArchive.ts";
import {
  AUTO_ROTATION,
  type Cell
} from "./viewport.ts";

// CONSTANTS
const kEmpty = ".";
const kUnchanged = " ";
const kUnknown = "?";
const kReserved = new Set([kEmpty, kUnchanged, kUnknown]);

export type LegendEntry = string | MapVoxel;
export type Drawing = Record<string, string[]>;
export type Levels = Readonly<Record<number, readonly string[]>>;

export interface SiteFrame {
  legend: Readonly<Record<string, LegendEntry>>;
  west: number;
  north: number;
  width: number;
  depth: number;
}

export interface SiteSurvey {
  drawing: Drawing;
  strays: string[];
}

export interface PartOptions {
  rotation?: number;
  flipY?: boolean;
}

export function part(
  block: string,
  options: PartOptions = {}
): MapVoxelPart {
  return {
    block,
    rotation: options.rotation ?? AUTO_ROTATION,
    flipY: options.flipY ?? false
  };
}

export function voxel(
  main: MapVoxelPart,
  partner: MapVoxelPart | null = null
): MapVoxel {
  return {
    ...main,
    partner
  };
}

export class Blueprint {
  static site(
    frame: SiteFrame
  ): Blueprint {
    const legend = new Map<string, MapVoxel>();
    for (const [symbol, entry] of Object.entries(frame.legend)) {
      if (symbol.length !== 1 || kReserved.has(symbol)) {
        throw new Error(`"${symbol}" cannot be a legend symbol.`);
      }
      legend.set(
        symbol,
        typeof entry === "string" ? voxel(part(entry)) : entry
      );
    }

    return new Blueprint(frame, legend, new Map());
  }

  readonly #frame: SiteFrame;
  readonly #legend: ReadonlyMap<string, MapVoxel>;
  readonly #levels: ReadonlyMap<number, string>;

  constructor(
    frame: SiteFrame,
    legend: ReadonlyMap<string, MapVoxel>,
    levels: ReadonlyMap<number, string>
  ) {
    this.#frame = frame;
    this.#legend = legend;
    this.#levels = levels;
  }

  with(
    levels: Levels
  ): Blueprint {
    const next = new Map(this.#levels);
    for (const [y, rows] of Object.entries(levels)) {
      const level = Number(y);
      next.set(level, this.#overlay(next.get(level) ?? this.#blank(), rows));
    }

    return new Blueprint(this.#frame, this.#legend, next);
  }

  withCopy(
    columns: number
  ): Blueprint {
    const { width } = this.#frame;
    const copy: Record<number, string[]> = {};
    for (const [y, level] of this.#levels) {
      const rows = level.match(new RegExp(`.{${width}}`, "g"))!;
      copy[y] = rows.map(
        (row) => " ".repeat(columns) +
          row.slice(0, width - columns).replaceAll(kEmpty, kUnchanged)
      );
    }

    return this.with(copy);
  }

  cells(
    symbol: string
  ): Cell[] {
    if (!this.#legend.has(symbol)) {
      throw new Error(`"${symbol}" is not in the legend.`);
    }

    const { west, north, width } = this.#frame;
    const cells: Cell[] = [];
    for (const [y, level] of this.#levels) {
      for (let index = 0; index < level.length; index++) {
        if (level[index] === symbol) {
          cells.push({
            x: west + (index % width),
            y,
            z: north + Math.floor(index / width)
          });
        }
      }
    }

    return cells;
  }

  drawing(): Drawing {
    return this.#draw(this.#levels);
  }

  survey(
    voxels: MapVoxels
  ): SiteSurvey {
    const { west, north, width, depth } = this.#frame;
    const levels = new Map<number, string[]>();
    const strays: string[] = [];
    for (const [key, placed] of Object.entries(voxels)) {
      const [x, y, z] = key.split(",").map(Number);
      const column = x - west;
      const row = z - north;
      const inside = column >= 0 && column < width && row >= 0 && row < depth;
      const symbol = this.#findSymbol(placed);
      if (inside) {
        const level = levels.get(y) ?? [...this.#blank()];
        level[(row * width) + column] = symbol ?? kUnknown;
        levels.set(y, level);
      }
      if (!inside || symbol === undefined) {
        strays.push(`${key} ${describeVoxel(placed)}`);
      }
    }

    return {
      drawing: this.#draw(
        new Map([...levels].map(([y, level]) => [y, level.join("")]))
      ),
      strays: strays.sort()
    };
  }

  #overlay(
    level: string,
    rows: readonly string[]
  ): string {
    const { width, depth } = this.#frame;
    if (rows.length > depth || rows.some((row) => row.length > width)) {
      throw new Error(`A level is larger than the ${width}x${depth} site.`);
    }

    const cells = [...level];
    rows.forEach((row, z) => {
      [...row].forEach((symbol, x) => {
        if (symbol === kUnchanged) {
          return;
        }
        if (symbol !== kEmpty && !this.#legend.has(symbol)) {
          throw new Error(`"${symbol}" is not in the legend.`);
        }
        cells[(z * width) + x] = symbol;
      });
    });

    return cells.join("");
  }

  #blank(): string {
    const { width, depth } = this.#frame;

    return kEmpty.repeat(width * depth);
  }

  #findSymbol(
    placed: MapVoxel
  ): string | undefined {
    for (const [symbol, entry] of this.#legend) {
      if (sameVoxel(entry, placed)) {
        return symbol;
      }
    }

    return undefined;
  }

  #draw(
    levels: ReadonlyMap<number, string>
  ): Drawing {
    const { width } = this.#frame;
    const drawing: Drawing = {};
    const heights = [...levels.keys()].sort((left, right) => left - right);
    for (const y of heights) {
      const level = levels.get(y)!;
      if ([...level].some((symbol) => symbol !== kEmpty)) {
        drawing[`y=${y}`] = level.match(new RegExp(`.{${width}}`, "g"))!;
      }
    }

    return drawing;
  }
}

function sameVoxel(
  left: MapVoxel,
  right: MapVoxel
): boolean {
  return samePart(left, right) && (
    left.partner === null || right.partner === null ?
      left.partner === right.partner :
      samePart(left.partner, right.partner)
  );
}

function samePart(
  left: MapVoxelPart,
  right: MapVoxelPart
): boolean {
  return left.block === right.block &&
    left.rotation === right.rotation &&
    left.flipY === right.flipY;
}

function describeVoxel(
  placed: MapVoxel
): string {
  const partner = placed.partner === null ?
    "" :
    ` + ${describePart(placed.partner)}`;

  return `${describePart(placed)}${partner}`;
}

function describePart(
  placed: MapVoxelPart
): string {
  return `${placed.block} r${placed.rotation}${placed.flipY ? " flipped" : ""}`;
}
