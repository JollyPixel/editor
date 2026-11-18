// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine/core";

export interface VoiceOptions {
  context: BaseAudioContext;
  buffer: AudioBuffer;
  output: AudioNode;
  rate: number;
  volume: number;
}

export class Voice implements Systems.SoundVoice {
  static start(
    options: VoiceOptions
  ): Voice {
    const voice = new Voice(options);
    voice.#source.start();

    return voice;
  }

  #context: BaseAudioContext;
  #source: AudioBufferSourceNode;
  #gain: GainNode;

  constructor(
    options: VoiceOptions
  ) {
    const { context } = options;
    this.#context = context;
    this.#gain = context.createGain();
    this.#gain.gain.value = options.volume;
    this.#gain.connect(options.output);
    this.#source = context.createBufferSource();
    this.#source.buffer = options.buffer;
    this.#source.playbackRate.value = options.rate;
    this.#source.connect(this.#gain);
    this.#source.addEventListener("ended", () => this.#gain.disconnect());
  }

  once(
    _event: "ended",
    listener: () => void
  ): void {
    this.#source.addEventListener("ended", listener, { once: true });
  }

  stop(
    options: Systems.SoundVoiceStopOptions
  ): void {
    const now = this.#context.currentTime;
    this.#gain.gain.setTargetAtTime(0, now, options.fade / 3);
    this.#source.stop(now + options.fade);
  }
}
