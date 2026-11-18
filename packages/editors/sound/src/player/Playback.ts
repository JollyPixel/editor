// Import Internal Dependencies
import type { PlaybackTuning } from "./PlaybackTuning.ts";

export interface PlaybackOptions {
  context: BaseAudioContext;
  source: AudioBufferSourceNode;
  tuning: PlaybackTuning;
  offset: number;
}

export class Playback {
  static start(
    options: PlaybackOptions
  ): Playback {
    const playback = new Playback(options);
    options.source.start(
      0,
      options.tuning.bufferOffset(playback.#offset)
    );

    return playback;
  }

  #context: BaseAudioContext;
  #source: AudioBufferSourceNode;
  #tuning: PlaybackTuning;
  #anchor: number;
  #offset: number;

  constructor(
    options: PlaybackOptions
  ) {
    this.#context = options.context;
    this.#source = options.source;
    this.#tuning = options.tuning;
    this.#anchor = options.context.currentTime;
    this.#offset = options.tuning.entry(options.offset);
    this.#tune(options.tuning);
  }

  get tuning(): PlaybackTuning {
    return this.#tuning;
  }

  elapsed(): number {
    const played = this.#context.currentTime - this.#anchor;

    return this.#tuning.advance(this.#offset, played) ??
      this.#tuning.end();
  }

  retune(
    tuning: PlaybackTuning
  ): void {
    this.#offset = this.elapsed();
    this.#anchor = this.#context.currentTime;
    this.#tuning = tuning;
    this.#tune(tuning);
  }

  onEnded(
    listener: () => void
  ): void {
    this.#source.addEventListener("ended", listener);
  }

  halt(): void {
    this.#source.stop();
    this.#source.disconnect();
  }

  #tune(
    tuning: PlaybackTuning
  ): void {
    const { loop } = tuning;
    this.#source.loop = loop !== null;
    if (loop !== null) {
      this.#source.loopStart = tuning.bufferOffset(
        tuning.reversed ? loop.end : loop.start
      );
      this.#source.loopEnd = tuning.bufferOffset(
        tuning.reversed ? loop.start : loop.end
      );
    }
    this.#source.playbackRate.value = tuning.rate;
  }
}
