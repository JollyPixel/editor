// Import Internal Dependencies
import type { WaveformBar } from "./Sound.ts";

// CONSTANTS
const kMaxBuckets = 8_192;

export class WaveformPeaks {
  #lowest: Float32Array;
  #highest: Float32Array;

  static scan(
    buffer: AudioBuffer
  ): WaveformPeaks {
    const { length } = buffer;
    const count = Math.min(length, kMaxBuckets);
    const lowest = new Float32Array(count).fill(Infinity);
    const highest = new Float32Array(count).fill(-Infinity);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let bucket = 0; bucket < count; bucket++) {
        const end = Math.floor((bucket + 1) * length / count);
        let low = lowest[bucket];
        let high = highest[bucket];
        for (let index = Math.floor(bucket * length / count); index < end; index++) {
          const sample = samples[index];
          if (sample < low) {
            low = sample;
          }
          if (sample > high) {
            high = sample;
          }
        }
        lowest[bucket] = low;
        highest[bucket] = high;
      }
    }

    return new WaveformPeaks(lowest, highest);
  }

  constructor(
    lowest: Float32Array,
    highest: Float32Array
  ) {
    this.#lowest = lowest;
    this.#highest = highest;
  }

  bars(
    width: number,
    height: number
  ): WaveformBar[] {
    const count = this.#lowest.length;
    const middle = height / 2;
    const bars: WaveformBar[] = [];

    for (let column = 0; column < width; column++) {
      const start = Math.floor(column * count / width);
      const end = Math.max(
        start + 1,
        Math.floor((column + 1) * count / width)
      );
      let lowest = Infinity;
      let highest = -Infinity;
      for (let bucket = start; bucket < end; bucket++) {
        lowest = Math.min(lowest, this.#lowest[bucket]);
        highest = Math.max(highest, this.#highest[bucket]);
      }
      const top = middle - highest * middle;
      const bottom = middle - lowest * middle;
      bars.push({
        top,
        height: Math.max(1, bottom - top)
      });
    }

    return bars;
  }
}
