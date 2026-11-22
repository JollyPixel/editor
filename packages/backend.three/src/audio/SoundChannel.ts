// Import Internal Dependencies
import type {
  SoundInstance,
  SoundStopOptions
} from "./SoundInstance.ts";

export class SoundChannel {
  #instance: SoundInstance | null = null;
  #ended: () => void;

  constructor(
    ended: () => void = () => undefined
  ) {
    this.#ended = ended;
  }

  get instance(): SoundInstance | null {
    return this.#instance;
  }

  get playing(): boolean {
    return this.#instance?.playing ?? false;
  }

  play(
    start: () => SoundInstance | null
  ): SoundInstance | null {
    this.stop();
    const instance = start();
    if (instance !== null) {
      this.#instance = instance;
      instance.once("ended", () => {
        if (this.#instance === instance) {
          this.#instance = null;
          this.#ended();
        }
      });
    }

    return instance;
  }

  stop(
    options: SoundStopOptions = {}
  ): void {
    const instance = this.#instance;
    this.#instance = null;
    instance?.stop(options);
  }

  pause(): void {
    this.#instance?.pause();
  }

  resume(): void {
    this.#instance?.resume();
  }
}
