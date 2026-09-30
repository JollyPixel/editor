// Import Internal Dependencies
import { InvalidVoxelWorldError } from "../errors/InvalidVoxelWorldError.ts";
import { isLayerRank } from "../../world/layerRank.ts";
import { validateChunk } from "../chunks/chunkEncoding.ts";
import { packPaletteEntry } from "../chunks/palette.ts";
import {
  inChunkRange,
  packChunkKey
} from "../../world/storage/chunkKey.ts";
import {
  VOXEL_WORLD_VERSION,
  type VoxelLayerJSON,
  type VoxelTemplateJSON,
  type VoxelWorldJSON
} from "../types.ts";

type Fail = (reason: string, cause?: unknown) => never;

export function parseVoxelWorld(
  value: unknown
): VoxelWorldJSON {
  if (typeof value !== "object" || value === null) {
    throw new InvalidVoxelWorldError("payload is not an object");
  }

  const version = readField(value, "version");
  const chunkSize = readField(value, "chunkSize");
  const layers = readField(value, "layers");
  const objectLayers = readField(value, "objectLayers");
  const tilesets = readField(value, "tilesets");
  const templates = readField(value, "templates");

  if (version !== VOXEL_WORLD_VERSION) {
    throw new InvalidVoxelWorldError(
      `unsupported version ${String(version)}`
    );
  }
  if (!isPowerOfTwo(chunkSize)) {
    throw new InvalidVoxelWorldError(
      "chunkSize is not a power of two"
    );
  }
  if (!Array.isArray(layers)) {
    throw new InvalidVoxelWorldError("layers is not an array");
  }

  const cellCount = chunkSize ** 3;
  const parsedLayers: VoxelLayerJSON[] = [];
  for (let index = 0; index < layers.length; index++) {
    const layer: unknown = layers[index];
    assertVoxelLayer(layer, index, cellCount);
    parsedLayers.push(layer);
  }

  const document: VoxelWorldJSON = {
    version,
    chunkSize,
    tilesets: Array.isArray(tilesets) ? tilesets : [],
    layers: parsedLayers
  };
  if (Array.isArray(objectLayers)) {
    document.objectLayers = objectLayers;
  }
  if (templates !== undefined) {
    if (!Array.isArray(templates)) {
      throw new InvalidVoxelWorldError("templates is not an array");
    }
    document.templates = [];
    for (let index = 0; index < templates.length; index++) {
      const template: unknown = templates[index];
      assertVoxelTemplate(template, `template ${index}`);
      document.templates.push(template);
    }
  }

  return document;
}

export function parseVoxelTemplate(
  value: unknown
): VoxelTemplateJSON {
  assertVoxelTemplate(value, "template");

  return value;
}

function assertVoxelTemplate(
  value: unknown,
  label: string
): asserts value is VoxelTemplateJSON {
  if (typeof value !== "object" || value === null) {
    throw new InvalidVoxelWorldError(`${label} is not an object`);
  }

  const id = readField(value, "id");
  const fail: Fail = failure(
    typeof id === "string" ? `template "${id}"` : label
  );
  const chunkSize = readField(value, "chunkSize");
  const properties = readField(value, "properties");
  if (typeof id !== "string") {
    fail("id is not a string");
  }
  if (typeof readField(value, "name") !== "string") {
    fail("name is not a string");
  }
  if (!isCoordinate(readField(value, "pivot"))) {
    fail("pivot is not a coordinate");
  }
  if (
    properties !== undefined &&
    (typeof properties !== "object" || properties === null)
  ) {
    fail("properties is not an object");
  }
  if (!isPowerOfTwo(chunkSize)) {
    fail("chunkSize is not a power of two");
  }
  assertVoxelGrid(value, chunkSize ** 3, fail);
}

function assertVoxelLayer(
  value: unknown,
  index: number,
  cellCount: number
): asserts value is VoxelLayerJSON {
  if (typeof value !== "object" || value === null) {
    throw new InvalidVoxelWorldError(`layer ${index} is not an object`);
  }

  const id = readField(value, "id");
  const fail: Fail = failure(
    typeof id === "string" ? `layer "${id}"` : `layer ${index}`
  );

  if (typeof id !== "string") {
    fail("id is not a string");
  }
  if (typeof readField(value, "name") !== "string") {
    fail("name is not a string");
  }
  if (typeof readField(value, "visible") !== "boolean") {
    fail("visible is not a boolean");
  }
  if (!isLayerRank(readField(value, "rank"))) {
    fail("rank is not a layer rank");
  }
  assertLayerOptions(value, fail);
  assertVoxelGrid(value, cellCount, fail);
}

function assertVoxelGrid(
  value: object,
  cellCount: number,
  fail: Fail
): void {
  function failOnRange(
    error: unknown,
    subject: string
  ): never {
    if (error instanceof RangeError) {
      fail(`${subject}: ${error.message}`, error);
    }

    throw error;
  }

  const palette = readField(value, "palette");
  if (!Array.isArray(palette)) {
    fail("palette is not an array");
  }
  for (let i = 0; i < palette.length; i++) {
    const entry: unknown = palette[i];
    if (typeof entry !== "object" || entry === null) {
      fail(`palette entry ${i} is not an object`);
    }
    const block = readField(entry, "block");
    const transform = readField(entry, "transform");
    if (typeof block !== "number" || typeof transform !== "number") {
      fail(`palette entry ${i} has no numeric block and transform`);
    }
    try {
      packPaletteEntry(block, transform);
    }
    catch (error) {
      failOnRange(error, `palette entry ${i}`);
    }
  }

  const chunks = readField(value, "chunks");
  if (!Array.isArray(chunks)) {
    fail("chunks is not an array");
  }
  const seen = new Set<number>();
  for (let i = 0; i < chunks.length; i++) {
    const chunk: unknown = chunks[i];
    if (typeof chunk !== "object" || chunk === null) {
      fail(`chunk ${i} is not an object`);
    }

    const at = readField(chunk, "at");
    if (!isChunkCoord(at)) {
      fail(`chunk ${i}: at is not a chunk coordinate in range`);
    }
    const key = packChunkKey(at[0], at[1], at[2]);
    const chunkWhere = `chunk [${at.join(",")}]`;
    if (seen.has(key)) {
      fail(`${chunkWhere} appears twice`);
    }
    seen.add(key);

    const runs = readField(chunk, "runs");
    const cells = readField(chunk, "cells");
    if (!isIndexArray(runs)) {
      fail(`${chunkWhere}: runs is not an array of indices`);
    }
    if (cells !== undefined && !isIndexArray(cells)) {
      fail(`${chunkWhere}: cells is not an array of indices`);
    }

    try {
      validateChunk(
        { gaps: cells ?? null, runs },
        cellCount,
        palette.length
      );
    }
    catch (error) {
      failOnRange(error, chunkWhere);
    }
  }
}

function assertLayerOptions(
  value: object,
  fail: Fail
): void {
  const compositing = readField(value, "compositing");
  if (
    compositing !== undefined &&
    compositing !== "replace" &&
    compositing !== "composite"
  ) {
    fail("compositing is not \"replace\" or \"composite\"");
  }

  const position = readField(value, "position");
  if (position !== undefined && !isCoordinate(position)) {
    fail("position is not a coordinate");
  }

  const properties = readField(value, "properties");
  if (
    properties !== undefined &&
    (typeof properties !== "object" || properties === null)
  ) {
    fail("properties is not an object");
  }
}

function failure(
  where: string
): Fail {
  return (reason, cause) => {
    throw new InvalidVoxelWorldError(`${where}: ${reason}`, { cause });
  };
}

function isCoordinate(
  value: unknown
): boolean {
  return typeof value === "object" &&
    value !== null &&
    Number.isFinite(readField(value, "x")) &&
    Number.isFinite(readField(value, "y")) &&
    Number.isFinite(readField(value, "z"));
}

function readField(
  value: object,
  key: string
): unknown {
  return Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined;
}

function isPowerOfTwo(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    (value & (value - 1)) === 0;
}

function isChunkCoord(
  value: unknown
): value is [number, number, number] {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every(Number.isInteger) &&
    inChunkRange(value[0], value[1], value[2]);
}

function isIndexArray(
  value: unknown
): value is number[] {
  if (!Array.isArray(value)) {
    return false;
  }

  for (const item of value) {
    if (!Number.isSafeInteger(item) || item < 0) {
      return false;
    }
  }

  return true;
}
