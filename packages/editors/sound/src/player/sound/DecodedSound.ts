// Import Internal Dependencies
import { Playback } from "../Playback.ts";
import { Voice } from "../Voice.ts";
import type {
  Sound,
  SoundFormat,
  SoundPlayOptions,
  SoundVoiceOptions,
  WaveformBar
} from "./Sound.ts";
import { Timecode } from "./Timecode.ts";
import { WaveformPeaks } from "./WaveformPeaks.ts";

// CONSTANTS
const kChannelLayouts: Record<number, string> = {
  1: "Mono",
  2: "Stereo"
};

export class DecodedSound implements Sound {
  readonly status = "ready";

  #buffer: AudioBuffer;
  #reversed: AudioBuffer | null = null;
  #peaks: WaveformPeaks | null = null;

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
    this.#peaks ??= WaveformPeaks.scan(this.#buffer);

    return this.#peaks.bars(width, height);
  }

  play(
    options: SoundPlayOptions
  ): Playback {
    const { context, output, tuning } = options;
    const source = context.createBufferSource();
    source.buffer = tuning.reversed
      ? this.#reversedBuffer(context)
      : this.#buffer;
    source.connect(output);

    return Playback.start({
      context,
      source,
      tuning,
      offset: options.offset
    });
  }

  voice(
    options: SoundVoiceOptions
  ): Voice {
    return Voice.start({
      ...options,
      buffer: this.#buffer
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
