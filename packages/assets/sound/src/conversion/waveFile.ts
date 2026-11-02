// CONSTANTS
const kHeaderLength = 44;
const kBytesPerSample = 2;
const kMaxSample = 0x7FFF;

export interface WaveFileOptions {
  sampleRate: number;
  channels: number;
  frames: number;

  sample(
    frame: number,
    channel: number
  ): number;
}

export function pcm16WaveFile(
  options: WaveFileOptions
): Uint8Array {
  const { sampleRate, channels, frames, sample } = options;
  const blockAlign = channels * kBytesPerSample;
  const dataLength = frames * blockAlign;
  const content = new Uint8Array(kHeaderLength + dataLength);
  const view = new DataView(content.buffer);
  const encoder = new TextEncoder();

  content.set(encoder.encode("RIFF"), 0);
  view.setUint32(4, kHeaderLength - 8 + dataLength, true);
  content.set(encoder.encode("WAVEfmt "), 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, kBytesPerSample * 8, true);
  content.set(encoder.encode("data"), 36);
  view.setUint32(40, dataLength, true);

  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.max(-1, Math.min(1, sample(frame, channel)));
      view.setInt16(
        kHeaderLength + frame * blockAlign + channel * kBytesPerSample,
        Math.round(value * kMaxSample),
        true
      );
    }
  }

  return content;
}
