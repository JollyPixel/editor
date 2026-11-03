// Import Third-party Dependencies
import { pcm16WaveFile } from "@jolly-pixel/asset.sound";

// CONSTANTS
const kSampleRate = 44_100;
const kNoteSeconds = 0.18;
const kTailSeconds = 0.9;
const kFrequencies = [523.25, 659.25, 783.99, 1046.5];
const kGain = 0.275;

export class Chime {
  waveFile(): Uint8Array {
    const seconds = kNoteSeconds * (kFrequencies.length - 1) + kTailSeconds;

    return pcm16WaveFile({
      sampleRate: kSampleRate,
      channels: 1,
      frames: Math.round(seconds * kSampleRate),
      sample: (frame) => this.#sample(frame / kSampleRate)
    });
  }

  #sample(
    time: number
  ): number {
    let sample = 0;
    kFrequencies.forEach((frequency, note) => {
      const elapsed = time - note * kNoteSeconds;
      if (elapsed >= 0) {
        sample += Math.sin(elapsed * 2 * Math.PI * frequency) *
          Math.exp(-elapsed * 5);
      }
    });

    return sample * kGain;
  }
}
