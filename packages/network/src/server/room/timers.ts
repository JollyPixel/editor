/**
 * Handle returned by a scheduled timer. Real timers hand back a
 * `NodeJS.Timeout`; a controlled clock hands back an id.
 */
export type TimerHandle = NodeJS.Timeout | number;

/**
 * Timer seam behind room eviction.
 *
 * Eviction is the only work the Server schedules on its own, so it is also
 * the only thing a caller cannot observe without either sleeping or owning
 * the clock. Injecting the timers keeps the grace period deterministic.
 */
export interface Timers {
  setTimeout(
    handler: () => void,
    ms: number
  ): TimerHandle;
  clearTimeout(
    handle: TimerHandle
  ): void;
}

/**
 * Real timers, unreffed so a pending eviction never keeps a process alive.
 */
export const systemTimers: Timers = {
  setTimeout(handler, ms) {
    const handle = setTimeout(handler, ms);
    handle.unref?.();

    return handle;
  },
  clearTimeout(handle) {
    clearTimeout(handle);
  }
};
