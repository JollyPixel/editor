export type TimerHandle = NodeJS.Timeout | number;

export interface Timers {
  setTimeout(
    handler: () => void,
    ms: number
  ): TimerHandle;
  clearTimeout(
    handle: TimerHandle
  ): void;
}

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
