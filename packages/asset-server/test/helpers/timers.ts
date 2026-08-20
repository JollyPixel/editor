// Import Internal Dependencies
import type { Timers } from "#src/index.ts";

interface ScheduledTask {
  id: number;
  at: number;
  handler: () => void;
}

export interface ManualTimers extends Timers {
  now: number;
  /**
   * Advances the clock, running every task that comes due.
   */
  advance(ms: number): void;
  readonly scheduled: number;
}

/**
 * Deterministic clock: eviction and snapshot tests advance time instead of
 * sleeping on it.
 */
export function manualTimers(): ManualTimers {
  let nextId = 1;
  let tasks: ScheduledTask[] = [];

  return {
    now: 0,
    get scheduled() {
      return tasks.length;
    },
    setTimeout(handler, ms) {
      const task: ScheduledTask = {
        id: nextId++,
        at: this.now + ms,
        handler
      };
      tasks.push(task);

      return task.id;
    },
    clearTimeout(handle) {
      tasks = tasks.filter((task) => task.id !== handle);
    },
    advance(ms) {
      this.now += ms;
      const due = tasks
        .filter((task) => task.at <= this.now)
        .sort((a, b) => a.at - b.at);
      tasks = tasks.filter((task) => task.at > this.now);
      for (const task of due) {
        task.handler();
      }
    }
  };
}
