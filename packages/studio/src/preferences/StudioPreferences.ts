// Import Third-party Dependencies
import * as z from "zod";
import {
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { SavedTabs } from "../tabs/SavedTabs.ts";

// CONSTANTS
export const TABS_STORAGE_KEY = "studio:tabs";
export const ASSET_KIND_STORAGE_KEY = "studio:asset-kind";
export const EXPANDED_FOLDERS_STORAGE_KEY = "studio:asset-expanded";
const kNodeIdsSchema = z.array(z.string());

export class StudioPreferences {
  readonly storage: StorageAdapter;

  constructor(
    storage: StorageAdapter = new LocalStorageAdapter()
  ) {
    this.storage = storage;
  }

  get tabs(): SavedTabs {
    return SavedTabs.parse(
      this.storage.get(TABS_STORAGE_KEY)
    );
  }

  set tabs(
    saved: SavedTabs
  ) {
    this.storage.set(
      TABS_STORAGE_KEY,
      JSON.stringify(saved)
    );
  }

  get assetKind(): string {
    return this.storage.get(
      ASSET_KIND_STORAGE_KEY
    ) ?? "";
  }

  set assetKind(
    kind: string
  ) {
    this.storage.set(
      ASSET_KIND_STORAGE_KEY,
      kind
    );
  }

  get expandedFolders(): ReadonlySet<string> {
    const ids = parseNodeIds(
      this.storage.get(EXPANDED_FOLDERS_STORAGE_KEY)
    );

    return new Set(ids);
  }

  set expandedFolders(
    nodeIds: ReadonlySet<string>
  ) {
    this.storage.set(
      EXPANDED_FOLDERS_STORAGE_KEY,
      JSON.stringify([...nodeIds])
    );
  }
}

function parseNodeIds(
  text: string | null
): string[] {
  if (text === null) {
    return [];
  }

  try {
    return kNodeIdsSchema
      .catch([])
      .parse(JSON.parse(text));
  }
  catch {
    return [];
  }
}
