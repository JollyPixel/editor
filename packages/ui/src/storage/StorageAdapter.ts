export interface StorageAdapter {
  get(key: string): string | null;
  set(
    key: string,
    value: string
  ): void;
}
