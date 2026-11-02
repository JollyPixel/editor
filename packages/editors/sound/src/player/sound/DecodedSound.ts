// Import Internal Dependencies
import { Playback } from "../Playback.ts";
import type {
  Sound,
  SoundFormat,
  SoundPlayOptions,
  WaveformBar
} from "./Sound.ts";
import { Timecode } from "./Timecode.ts";

// CONSTANTS
const kChannelLayouts: Record<number, string> = {
  1: "Mono",
  2: "Stereo"
};

export class DecodedSound implements Sound {
  readonly status = "ready";

  #buffer: AudioBuffer;
  #reversed: AudioBuffer | null = null;

  constructor(
    buffer: AudioBuffer
  ) {
    this.#buffer = buffer;
  }

  get duration(): number {
    return this.#buffer.duration;
  }

  timecode(
    elapsed: number | null
  ): string {
    return `${new Timecode(elapsed ?? 0)} / ${new Timecode(this.duration)}`;
  }

  format(): SoundFormat {
    const { sampleRate, numberOfChannels } = this.#buffer;

    return {
      sampleRate: `${sampleRate / 1000} kHz`,
      channels: kChannelLayouts[numberOfChannels] ??
        `${numberOfChannels} channels`
    };
  }

  waveform(
    width: number,
    height: number
  ): WaveformBar[] {
    const buffer = this.#buffer;
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

  play(
    options: SoundPlayOptions
  ): Playback {
    const { context, output, mode } = options;
    const source = context.createBufferSource();
    source.buffer = mode.reversed
      ? this.#reversedBuffer(context)
      : this.#buffer;
    source.connect(output);

    return Playback.start({
      context,
      source,
      mode,
      offset: options.offset,
      duration: this.duration
    });
  }

  #reversedBuffer(
    context: BaseAudioContext
  ): AudioBuffer {
    if (this.#reversed !== null) {
      return this.#reversed;
    }

    const buffer = this.#buffer;
    const reversed = context.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = reversed.getChannelData(channel);
      samples.set(buffer.getChannelData(channel));
      samples.reverse();
    }
    this.#reversed = reversed;

    return reversed;
  }
}
