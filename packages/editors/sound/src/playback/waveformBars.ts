export interface WaveformBar {
  readonly top: number;
  readonly height: number;
}

export function waveformBars(
  buffer: AudioBuffer,
  width: number,
  height: number
): WaveformBar[] {
  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, index) => buffer.getChannelData(index)
  );
  const { length } = buffer;
  const middle = height / 2;
  const bars: WaveformBar[] = [];

  for (let column = 0; column < width; column++) {
    const start = Math.floor(column * length / width);
    const end = Math.max(
      start + 1,
      Math.floor((column + 1) * length / width)
    );
    let lowest = Infinity;
    let highest = -Infinity;
    for (const channel of channels) {
      for (let index = start; index < end; index++) {
        lowest = Math.min(lowest, channel[index]);
        highest = Math.max(highest, channel[index]);
      }
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
