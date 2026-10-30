// Import Internal Dependencies
import { CHUNK_SAMPLES } from "./ChunkCoord.ts";

// CONSTANTS
export const CHUNK_TIERS = [1, 2, 4] as const;

export type ChunkTier = typeof CHUNK_TIERS[number];

export function isChunkTier(
  value: unknown
): value is ChunkTier {
  return CHUNK_TIERS.some((tier) => tier === value);
}

export function chunkResolution(
  tier: ChunkTier
): number {
  return CHUNK_SAMPLES * tier;
}

export function chunkSampleCount(
  tier: ChunkTier
): number {
  return chunkResolution(tier) ** 2;
}

export function tierOfSampleCount(
  count: number
): ChunkTier | null {
  return CHUNK_TIERS.find((tier) => chunkSampleCount(tier) === count) ?? null;
}
