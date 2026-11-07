// CONSTANTS
export const NETWORK_PRESETS = {
  "fast-4g": {
    latency: 165,
    downloadThroughput: 9_000_000 / 8 * 0.9,
    uploadThroughput: 1_500_000 / 8 * 0.9
  },
  "slow-4g": {
    latency: 562.5,
    downloadThroughput: 1_600_000 / 8 * 0.9,
    uploadThroughput: 750_000 / 8 * 0.9
  }
} satisfies Record<string, NetworkConditions>;

export interface NetworkConditions {
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
}

export type NetworkPreset = keyof typeof NETWORK_PRESETS;
