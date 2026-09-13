// Import Internal Dependencies
import { LocalStorageAdapter } from "./LocalStorageAdapter.ts";
import type { StorageAdapter } from "./StorageAdapter.ts";

// CONSTANTS
const kDefaultAdapter = new LocalStorageAdapter();

export function defaultStorageAdapter(): StorageAdapter {
  return kDefaultAdapter;
}
