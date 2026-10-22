// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { Preferences } from "@jolly-pixel/editor.host/preferences";
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorRegistry } from "../../src/editors/EditorRegistry.ts";
import { BrowserState } from "../../src/browser/BrowserState.ts";
import { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import {
  StudioSession,
  type StudioCatalog,
  type StudioSessionOptions
} from "../../src/shell/StudioSession.ts";
import { idleShare } from "./catalogShare.ts";

// CONSTANTS
export const MAP_RECORD: AssetRecordData = {
  id: "map-1",
  kind: "voxelmap",
  path: "maps/overworld.voxelmap.json"
};
export const CAVE_RECORD: AssetRecordData = {
  id: "map-2",
  kind: "voxelmap",
  path: "maps/cave.voxelmap.json"
};
export const MODEL_RECORD: AssetRecordData = {
  id: "model-1",
  kind: "voxelmodel",
  path: "models/model.voxelmodel.json"
};
export const TEXTURE_RECORD: AssetRecordData = {
  id: "texture-1",
  kind: "texture",
  path: "textures/block.png"
};

export class FakeCatalog implements StudioCatalog {
  records = new Map<string, AssetRecordData>();
  #listeners = new Set<() => void>();

  constructor(
    records: Iterable<AssetRecordData>
  ) {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  get listening(): number {
    return this.#listeners.size;
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.records.get(assetId);
  }

  on(
    _event: "change",
    listener: () => void
  ): void {
    this.#listeners.add(listener);
  }

  off(
    _event: "change",
    listener: () => void
  ): void {
    this.#listeners.delete(listener);
  }

  change(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

let current: StudioSession | undefined;

export function session(
  catalog: FakeCatalog,
  storage: StorageAdapter = new MemoryStorageAdapter(),
  cap?: number,
  extra: Partial<StudioSessionOptions> = {}
): StudioSession {
  const strip = Object.assign(document.createElement("jolly-tabs"), {
    value: ""
  });
  const frames = document.createElement("div");
  const home = document.createElement("section");
  const settings = document.createElement("section");
  document.body.append(strip, frames, home, settings);
  current = new StudioSession({
    catalog,
    share: idleShare(),
    user: {
      identity: null,
      preferences: new Preferences(),
      renewal: null
    },
    scopes: new PreferenceScopes([]),
    launchOrigin: "http://localhost",
    slots: {
      strip,
      frames,
      home,
      settings
    },
    cap,
    browserState: new BrowserState(storage),
    ...extra,
    editors: new EditorRegistry()
      .registerKind({
        kind: "voxelmap",
        label: "Voxel map",
        extension: ".voxelmap.json",
        convertsFrom: []
      })
      .registerEditor({
        name: "voxel-map",
        kinds: ["voxelmap"]
      })
      .registerEditor({
        name: "voxel-model",
        kinds: ["voxelmodel"]
      })
  });

  return current;
}

export function frameTargets(): string[] {
  return [...document.querySelectorAll("iframe")].map(
    (frame) => new URL(frame.src).searchParams.get("target") ?? ""
  );
}

export function disposeSession(): void {
  current?.dispose();
  current = undefined;
  document.body.replaceChildren();
}
