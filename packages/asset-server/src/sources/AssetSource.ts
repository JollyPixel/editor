/**
 * Physical store using root-relative POSIX paths.
 */
export interface AssetSource {
  read(
    path: string
  ): Promise<Uint8Array>;

  /**
   * Writes atomically: a crashed write never leaves a half file behind.
   */
  write(
    path: string,
    data: Uint8Array
  ): Promise<void>;

  /**
   * Removing a missing path is a no-op, so a replayed delete stays safe.
   */
  delete(
    path: string
  ): Promise<void>;

  /**
   * Root-relative POSIX paths, sorted, excluding ignored entries.
   */
  list(): Promise<string[]>;

  /**
   * Subscribes to external changes. Returns an unsubscribe function.
   */
  watch?(
    onChange: (path: string) => void
  ): () => void;
}
