// Import Internal Dependencies
import { pcm16WaveFile } from "#src/index.ts";

// CONSTANTS
const kFrequency = 440;
const kGain = 0.37;

export interface SineWaveOptions {
  seconds: number;
  sampleRate: number;
  channels: number;
}

export function sineWaveFile(
  options: SineWaveOptions
): Uint8Array {
  const { seconds, sampleRate, channels } = options;

  return pcm16WaveFile({
    sampleRate,
    channels,
    frames: Math.round(seconds * sampleRate),
    sample: (frame) => Math.sin(frame / sampleRate * 2 * Math.PI * kFrequency) * kGain
  });
}
