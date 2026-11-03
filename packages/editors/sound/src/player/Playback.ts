// Import Internal Dependencies
import type { PlaybackMode } from "./PlaybackMode.ts";

export interface PlaybackOptions {
  context: BaseAudioContext;
  source: AudioBufferSourceNode;
  mode: PlaybackMode;
  offset: number;
  duration: number;
}

export class Playback {
  static start(
    options: PlaybackOptions
  ): Playback {
    const playback = new Playback(options);
    options.source.start(
      0,
      options.mode.bufferOffset(options.offset, options.duration)
    );

    return playback;
  }

  #context: BaseAudioContext;
  #source: AudioBufferSourceNode;
  #mode: PlaybackMode;
  #anchor: number;
  #offset: number;
  #duration: number;

  constructor(
    options: PlaybackOptions
  ) {
    this.#context = options.context;
    this.#source = options.source;
    this.#mode = options.mode;
    this.#anchor = options.context.currentTime;
    this.#offset = options.offset;
    this.#duration = options.duration;
    this.#tune(options.mode);
  }

  elapsed(): number {
    const played = this.#context.currentTime - this.#anchor;

    return this.#mode.advance(this.#offset, played, this.#duration) ??
      this.#mode.end(this.#duration);
  }

  retune(
    mode: PlaybackMode
  ): void {
    this.#offset = this.elapsed();
    this.#anchor = this.#context.currentTime;
    this.#mode = mode;
    this.#tune(mode);
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
    mode: PlaybackMode
  ): void {
    this.#source.loop = mode.loop;
    this.#source.playbackRate.value = mode.speed;
  }
}
