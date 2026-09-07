export interface VoxelLogger {
  child(
    options: { namespace: string; }
  ): VoxelLogger;
  debug(
    msg: string,
    meta?: Record<string, unknown>
  ): void;
  warn(
    msg: string,
    meta?: Record<string, unknown>
  ): void;
  error(
    msg: string,
    meta?: Record<string, unknown>
  ): void;
}

export const NOOP_LOGGER: VoxelLogger = {
  child() {
    return NOOP_LOGGER;
  },
  debug() {
    // Intentionally empty.
  },
  warn() {
    // Intentionally empty.
  },
  error() {
    // Intentionally empty.
  }
};
