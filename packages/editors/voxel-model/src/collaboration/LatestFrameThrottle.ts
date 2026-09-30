export class LatestFrameThrottle<TFrame> {
  #intervalMs: number;
  #send: (frame: TFrame) => void;
  #pending: { frame: TFrame; } | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #lastSentAt = 0;

  constructor(
    intervalMs: number,
    send: (frame: TFrame) => void
  ) {
    this.#intervalMs = intervalMs;
    this.#send = send;
  }

  push(
    frame: TFrame
  ): void {
    this.#pending = { frame };
    if (this.#timer !== null) {
      return;
    }

    const wait = this.#intervalMs - (Date.now() - this.#lastSentAt);
    if (wait <= 0) {
      this.#flush();
    }
    else {
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.#flush();
      }, wait);
    }
  }

  cancel(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#pending = null;
    this.#lastSentAt = 0;
  }

  #flush(): void {
    const pending = this.#pending;
    if (pending === null) {
      return;
    }

    this.#pending = null;
    this.#lastSentAt = Date.now();
    this.#send(pending.frame);
  }
}
