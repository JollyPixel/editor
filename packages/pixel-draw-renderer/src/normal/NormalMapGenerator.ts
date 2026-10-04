// Import Internal Dependencies
import { IslandJob } from "./IslandJob.ts";
import { RectArea } from "../utils/RectArea.ts";
import type {
  Island,
  NormalMapInput
} from "./types.ts";
import type { SelectionRect } from "../types.ts";

// CONSTANTS
const kFar = 0x3FFFFFFF;
const kOpaqueAlpha = 0xFF000000;
const kFlatWord = (kOpaqueAlpha | (255 << 16) | (128 << 8) | 128) >>> 0;

export class NormalMapGenerator {
  #heights = new Float32Array(0);
  #distances = new Int32Array(0);
  #colors = new Uint32Array(0);
  #clear = new Uint8Array(0);

  static generate(
    input: NormalMapInput
  ): Uint8ClampedArray {
    const output = new Uint8ClampedArray(
      input.size.x * input.size.y * 4
    );
    const generator = new NormalMapGenerator();
    for (const island of input.islands.islands) {
      generator.writeIsland(input, output, island);
    }

    return output;
  }

  writeIsland(
    input: NormalMapInput,
    output: Uint8ClampedArray,
    island: Island,
    area: SelectionRect = island.bounds
  ): SelectionRect | null {
    const settings = input.config?.resolve(island.regionIds) ?? "off";
    if (settings === "off") {
      return NormalMapGenerator.#writeFlat(input, output, island, area);
    }

    const job = IslandJob.plan(input, island, settings, area);
    if (job === null) {
      return null;
    }

    this.#reserve(job.area);
    this.#fillHeights(job);
    this.#writeNormals(job, output);

    return { ...job.target };
  }

  #reserve(
    length: number
  ): void {
    if (this.#heights.length > length) {
      return;
    }

    this.#heights = new Float32Array(length + 1);
    this.#distances = new Int32Array(length + 1);
    this.#colors = new Uint32Array(length + 1);
    this.#clear = new Uint8Array(length + 1);
  }

  #fillHeights(
    job: IslandJob
  ): void {
    const { pixels, indices, index, width, settings, window } = job;
    const heights = this.#heights;
    const distances = this.#distances;
    const clear = this.#clear;
    const byRegion = settings.height === "regions";
    if (byRegion) {
      this.#fillColors(job);
      this.#distanceField(job, true);
    }

    let local = 0;
    for (let y = window.y; y < window.y + window.height; y++) {
      let pixel = (y * width) + window.x;
      for (let column = 0; column < window.width; column++, local++, pixel++) {
        const offset = pixel * 4;
        const alpha = pixels[offset + 3];
        clear[local] = Number(alpha === 0);
        if (indices[pixel] !== index || alpha === 0) {
          heights[local] = 0;
          continue;
        }

        let height = 1;
        if (byRegion) {
          height = job.bevel(distances[local]);
        }
        else if (settings.height === "luminance") {
          height = (
            (0.2126 * pixels[offset]) +
            (0.7152 * pixels[offset + 1]) +
            (0.0722 * pixels[offset + 2])
          ) / 255;
        }
        if (settings.invert) {
          height = 1 - height;
        }
        heights[local] = height * (alpha / 255);
      }
    }

    clear[job.area] = 0;
    if (settings.border === "bevel") {
      this.#distanceField(job, false);
      for (let cell = 0; cell < job.area; cell++) {
        if (distances[cell] >= 0) {
          heights[cell] *= job.bevel(distances[cell]);
        }
      }
    }
  }

  #fillColors(
    job: IslandJob
  ): void {
    const { pixels, width, window } = job;
    const colors = this.#colors;
    let local = 0;
    for (let y = window.y; y < window.y + window.height; y++) {
      let offset = ((y * width) + window.x) * 4;
      for (let column = 0; column < window.width; column++, local++, offset += 4) {
        const alpha = pixels[offset + 3];
        colors[local] = alpha === 0 ?
          0 :
          (
            (pixels[offset] << 24) |
            (pixels[offset + 1] << 16) |
            (pixels[offset + 2] << 8) |
            alpha
          ) >>> 0;
      }
    }
  }

  #distanceField(
    job: IslandJob,
    byColor: boolean
  ): void {
    const { indices, index, width, window } = job;
    const distances = this.#distances;
    const colors = this.#colors;
    const columns = window.width;
    const rows = window.height;

    function linked(
      a: number,
      b: number
    ): boolean {
      return distances[b] !== -1 && (!byColor || colors[a] === colors[b]);
    }

    let local = 0;
    for (let row = 0; row < rows; row++) {
      let pixel = ((window.y + row) * width) + window.x;
      for (let column = 0; column < columns; column++, local++, pixel++) {
        distances[local] = indices[pixel] === index ? kFar : -1;
      }
    }

    local = 0;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++, local++) {
        if (
          distances[local] !== -1 && (
            column === 0 || !linked(local, local - 1) ||
            column === columns - 1 || !linked(local, local + 1) ||
            row === 0 || !linked(local, local - columns) ||
            row === rows - 1 || !linked(local, local + columns)
          )
        ) {
          distances[local] = 0;
        }
      }
    }

    for (local = 0; local < rows * columns; local++) {
      if (distances[local] > 0) {
        distances[local] = Math.min(
          distances[local],
          distances[local - 1] + 1,
          distances[local - columns] + 1
        );
      }
    }
    for (local = (rows * columns) - 1; local >= 0; local--) {
      if (distances[local] > 0) {
        distances[local] = Math.min(
          distances[local],
          distances[local + 1] + 1,
          distances[local + columns] + 1
        );
      }
    }
  }

  #writeNormals(
    job: IslandJob,
    output: Uint8ClampedArray
  ): void {
    const { pixels, indices, index, width, height, settings, target, window } = job;
    const { strength, edgeIntensity } = settings;
    const words = new Uint32Array(output.buffer, output.byteOffset, output.length >> 2);
    const heights = this.#heights;
    const clear = this.#clear;
    const outside = job.area;
    const outsideScale = settings.border === "bevel" ? 0 : 1;
    const weights = [1, edgeIntensity];
    const step = settings.levels >= 3 ? 2 / (settings.levels - 1) : 0;
    const right = target.x + target.width;
    const bottom = target.y + target.height;

    for (let y = target.y; y < bottom; y++) {
      let pixel = (y * width) + target.x;
      let local = ((y - window.y) * window.width) + target.x - window.x;
      for (let x = target.x; x < right; x++, pixel++, local++) {
        if (indices[pixel] !== index) {
          continue;
        }
        if (pixels[(pixel * 4) + 3] === 0) {
          words[pixel] = kFlatWord;
          continue;
        }

        const center = heights[local];
        heights[outside] = center * outsideScale;
        const west = x > 0 && indices[pixel - 1] === index ?
          local - 1 :
          job.neighbour(x - 1, y);
        const east = x < width - 1 && indices[pixel + 1] === index ?
          local + 1 :
          job.neighbour(x + 1, y);
        const north = y > 0 && indices[pixel - width] === index ?
          local - window.width :
          job.neighbour(x, y - 1);
        const south = y < height - 1 && indices[pixel + width] === index ?
          local + window.width :
          job.neighbour(x, y + 1);
        const dx = (
          ((heights[east] - center) * weights[clear[east]]) +
          ((center - heights[west]) * weights[clear[west]])
        ) * strength;
        const dy = (
          ((heights[south] - center) * weights[clear[south]]) +
          ((center - heights[north]) * weights[clear[north]])
        ) * strength;

        words[pixel] = NormalMapGenerator.#pack(-dx, dy, step);
      }
    }
  }

  static #writeFlat(
    input: NormalMapInput,
    output: Uint8ClampedArray,
    island: Island,
    area: SelectionRect
  ): SelectionRect | null {
    const target = RectArea.from(area).clippedTo(island.bounds)?.bounds;
    if (target === undefined) {
      return null;
    }

    const { indices } = input.islands;
    const { index } = island;
    const width = input.size.x;
    const words = new Uint32Array(output.buffer, output.byteOffset, output.length >> 2);
    for (let y = target.y; y < target.y + target.height; y++) {
      for (let x = target.x; x < target.x + target.width; x++) {
        const pixel = (y * width) + x;
        if (indices[pixel] === index) {
          words[pixel] = kFlatWord;
        }
      }
    }

    return target;
  }

  static #pack(
    x: number,
    y: number,
    step: number
  ): number {
    let inverse = 1 / Math.sqrt((x * x) + (y * y) + 1);
    let nx = x * inverse;
    let ny = y * inverse;
    let nz = inverse;

    if (step > 0) {
      nx = Math.round(nx / step) * step;
      ny = Math.round(ny / step) * step;
      nz = Math.sqrt(Math.max(0, 1 - (nx * nx) - (ny * ny)));
      inverse = 1 / Math.sqrt((nx * nx) + (ny * ny) + (nz * nz));
      nx *= inverse;
      ny *= inverse;
      nz *= inverse;
    }

    return (
      ((nx * 127.5) + 128) |
      (((ny * 127.5) + 128) << 8) |
      (((nz * 127.5) + 128) << 16) |
      kOpaqueAlpha
    ) >>> 0;
  }
}
