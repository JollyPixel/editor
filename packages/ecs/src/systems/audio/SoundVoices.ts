// Import Internal Dependencies
import type { SoundSettings } from "./SoundSettings.ts";

// CONSTANTS
const kStealFade = 0.03;

export interface SoundVoiceStopOptions {
  fade: number;
}

export interface SoundVoice {
  stop(options: SoundVoiceStopOptions): void;
  once(event: "ended", listener: () => void): unknown;
}

interface PlayingVoice<TVoice extends SoundVoice> {
  sound: object;
  voice: TVoice;
}

export class SoundVoices<TVoice extends SoundVoice> implements Iterable<TVoice> {
  readonly limit: number;

  #playing: PlayingVoice<TVoice>[] = [];
  #lastStarts = new WeakMap<object, number>();

  constructor(
    limit = Number.POSITIVE_INFINITY
  ) {
    this.limit = Math.max(Math.floor(limit), 1);
  }

  get size(): number {
    return this.#playing.length;
  }

  start(
    sound: object,
    settings: Readonly<SoundSettings>,
    now: number,
    create: () => TVoice | null
  ): TVoice | null {
    const lastStart = this.#lastStarts.get(sound);
    if (lastStart !== undefined && now - lastStart < settings.cooldown) {
      return null;
    }

    const voice = create();
    if (voice === null) {
      return null;
    }
    if (settings.maxInstances > 0) {
      const same = this.#playing.filter((playing) => playing.sound === sound);
      for (const playing of same.slice(0, same.length - settings.maxInstances + 1)) {
        this.#steal(playing);
      }
    }
    if (this.#playing.length >= this.limit) {
      this.#steal(this.#playing[0]);
    }
    this.#lastStarts.set(sound, now);

    const playing = {
      sound,
      voice
    };
    this.#playing.push(playing);
    voice.once("ended", () => this.#release(playing));

    return voice;
  }

  stopAll(): void {
    for (const playing of [...this.#playing]) {
      this.#steal(playing);
    }
  }

  * [Symbol.iterator](): IterableIterator<TVoice> {
    for (const { voice } of this.#playing) {
      yield voice;
    }
  }

  #release(
    playing: PlayingVoice<TVoice>
  ): void {
    const index = this.#playing.indexOf(playing);
    if (index !== -1) {
      this.#playing.splice(index, 1);
    }
  }

  #steal(
    playing: PlayingVoice<TVoice>
  ): void {
    this.#release(playing);
    playing.voice.stop({ fade: kStealFade });
  }
}
