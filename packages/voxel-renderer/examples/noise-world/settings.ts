interface IntBounds {
  default: number;
  min: number;
  max: number;
}

// CONSTANTS
export const MAX_SEED = 0x7FFFFFFF;

const kSizeBounds: IntBounds = {
  default: 512,
  min: 256,
  max: 5120
};
const kChunkBounds: IntBounds = {
  default: 32,
  min: 16,
  max: 256
};
const kSeedBounds: IntBounds = {
  default: 1337,
  min: 0,
  max: MAX_SEED
};
const kMaxWorkers = 32;
const kSmallWorldSize = 512;

export class WorldSettings {
  readonly size: number;
  readonly chunkSize: number;
  readonly seed: number;
  readonly workers: number;

  constructor(
    params: URLSearchParams
  ) {
    this.size = readInt(params, "size", kSizeBounds);
    this.chunkSize = readInt(params, "chunk", kChunkBounds);
    this.seed = readInt(params, "seed", kSeedBounds);
    this.workers = readInt(params, "workers", {
      default: defaultWorkerCount(this.size),
      min: 0,
      max: kMaxWorkers
    });
  }
}

function defaultWorkerCount(
  size: number
): number {
  const workers = size <= kSmallWorldSize ? 2 : 4;
  const spareCores = Math.max(1, navigator.hardwareConcurrency - 1);

  return Math.min(workers, spareCores);
}

function readInt(
  params: URLSearchParams,
  key: string,
  bounds: IntBounds
): number {
  const value = Number.parseInt(params.get(key) ?? "", 10);
  if (Number.isNaN(value)) {
    return bounds.default;
  }

  return Math.min(bounds.max, Math.max(bounds.min, value));
}
