/**
 * Physical store using root-relative POSIX paths.
 */
export interface AssetSource {
  read(
    path: string
  ): Promise<Uint8Array>;

  write(
    path: string,
    data: Uint8Array
  ): Promise<void>;

  delete(
    path: string
  ): Promise<void>;

  list(): Promise<string[]>;

  isIgnored?(
    path: string
  ): boolean;

  watch?(
    onChange: (path: string) => void
  ): () => void;
}
