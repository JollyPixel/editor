export interface TimerOptions {
  /**
   * @default true
   */
  autoStart?: boolean;
  /**
   * @default true
   */
  loop?: boolean;
  callback?: () => void;
}

export class Timer {
  interval: number;
  loop: boolean;
  #tick = 1;
  #isStarted: boolean;
  #callback: (() => void);

  constructor(
    tickInterval = 60,
    options: TimerOptions = {}
  ) {
    const {
      autoStart = true,
      loop: keepIterating = true,
      callback = () => void 0
    } = options;

    this.interval = tickInterval;
    this.loop = keepIterating;
    this.#isStarted = autoStart;
    this.#callback = callback;
  }

  start() {
    this.#isStarted = true;
  }

  walk() {
    if (!this.#isStarted) {
      return false;
    }

    if (this.#tick < this.interval) {
      this.#tick++;

      return false;
    }

    if (!this.loop) {
      this.#isStarted = false;
    }

    this.#tick = 1;
    this.#callback();

    return true;
  }
}
