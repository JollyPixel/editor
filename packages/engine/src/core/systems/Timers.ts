export interface TimerOptions {
  /**
   * Fires every `seconds` until cancelled instead of once.
   * @default false
   */
  repeat?: boolean;
}

export interface Timer {
  readonly active: boolean;
  cancel(): void;
}

interface TimerEntry {
  due: number;
  interval: number;
  repeat: boolean;
  callback: () => void;
}

export class Timers {
  #now = 0;
  #entries = new Set<TimerEntry>();

  get pending(): boolean {
    return this.#entries.size > 0;
  }

  schedule(
    seconds: number,
    callback: () => void,
    options: TimerOptions = {}
  ): Timer {
    const repeat = options.repeat ?? false;
    if (!(seconds >= 0) || (repeat && seconds === 0)) {
      throw new RangeError(
        `Timer delay must be a positive number of seconds, got ${seconds}.`
      );
    }

    const entries = this.#entries;
    const entry: TimerEntry = {
      due: this.#now + seconds,
      interval: seconds,
      repeat,
      callback
    };
    entries.add(entry);

    return {
      get active() {
        return entries.has(entry);
      },
      cancel: () => {
        entries.delete(entry);
      }
    };
  }

  advance(
    now: number
  ): void {
    this.#now = now;

    let due: TimerEntry[] | null = null;
    for (const entry of this.#entries) {
      if (entry.due <= now) {
        (due ??= []).push(entry);
      }
    }
    if (due === null) {
      return;
    }

    due.sort((left, right) => left.due - right.due);
    for (const entry of due) {
      if (!this.#entries.has(entry)) {
        continue;
      }

      if (entry.repeat) {
        const next = entry.due + entry.interval;
        entry.due = next > now ? next : now + entry.interval;
      }
      else {
        this.#entries.delete(entry);
      }
      entry.callback();
    }
  }
}
