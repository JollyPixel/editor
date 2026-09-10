/**
 * Physical store using root-relative POSIX paths.
 */
export interface AssetSource {
  read(
    path: string
  ): Promise<Uint8Array>;

  exists(
    path: string
  ): Promise<boolean>;

  write(
    path: string,
    data: Uint8Array
  ): Promise<void>;

  writeIfAbsent(
    path: string,
    data: Uint8Array
  ): Promise<boolean>;

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
