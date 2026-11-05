// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import {
  MemoryStorageAdapter,
  NotificationQueue
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../../src/catalog/AssetKindSet.ts";
import { BrowserState } from "../../src/browser/BrowserState.ts";
import {
  AssetTreeView,
  type KindFilterSource
} from "../../src/shell/assets/AssetTreeView.ts";
import type { FakeTreeCatalog } from "./assetTree.ts";

// CONSTANTS
export const MAP_RECORD: AssetRecordData = {
  id: "map-1",
  kind: "voxelmap",
  path: "maps/overworld.voxelmap.json"
};
export const MODEL_RECORD: AssetRecordData = {
  id: "model-1",
  kind: "voxelmodel",
  path: "maps/hero.voxelmodel.json"
};
export const MODEL_MAX_CONTENT_BYTES = 12 * 1024 * 1024;
export const CATALOG_MAX_CONTENT_BYTES = 16 * 1024 * 1024;
export const TREE_KINDS = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json",
      extensions: [".voxelmap.json"]
    },
    {
      kind: "voxelmodel",
      label: "Voxel model",
      extension: ".voxelmodel.json",
      extensions: [".voxelmodel.json"],
      convertsFrom: [".vox"],
      maxContentBytes: MODEL_MAX_CONTENT_BYTES
    },
    {
      kind: "pixelart",
      label: "Pixel art",
      extension: ".pixelart",
      extensions: [".pixelart"],
      convertsFrom: [".png"]
    }
  ],
  editable: ["voxelmap", "voxelmodel"],
  maxContentBytes: CATALOG_MAX_CONTENT_BYTES
});

export interface TreeViewProbe {
  view: AssetTreeView;
  browserState: BrowserState;
  notifications: NotificationQueue;
  errors: string[];
  created: string[];
  imported: string[];
  prompted: string[];
}

export interface TreeViewOptions {
  sharing?: boolean;
  picks?: Array<File | null>;
  kindFilter?: KindFilterSource;
  acceptLargeFiles?: boolean;
}

export function treeView(
  catalog: FakeTreeCatalog,
  options: TreeViewOptions = {}
): TreeViewProbe {
  const {
    sharing = false,
    picks = [],
    kindFilter = null,
    acceptLargeFiles = false
  } = options;
  const browserState = new BrowserState(new MemoryStorageAdapter());
  const notifications = new NotificationQueue();
  const errors: string[] = [];
  const created: string[] = [];
  const imported: string[] = [];
  const prompted: string[] = [];
  const view = new AssetTreeView({
    catalog,
    kinds: TREE_KINDS,
    kindFilter,
    browserState,
    prompts: {
      open: (assetId) => prompted.push(`open ${assetId}`),
      rename: (nodeId) => prompted.push(`rename ${nodeId}`),
      share: sharing ?
        (asset) => prompted.push(`share ${asset.id}`) :
        null,
      confirmDelete: async() => {
        prompted.push("confirm delete");

        return null;
      },
      confirmLargeFiles: async(files) => {
        prompted.push(`confirm large ${files.map((file) => file.name).join(",")}`);

        return acceptLargeFiles;
      },
      pickFile: async(accept) => {
        prompted.push(`pick ${accept.join(",")}`);

        return picks.shift() ?? null;
      }
    },
    notifications,
    onChange: () => undefined,
    onError: (message) => errors.push(message),
    onCreated: (nodeId) => created.push(nodeId),
    onImported: (nodeId) => imported.push(nodeId)
  });

  return {
    view,
    browserState,
    notifications,
    errors,
    created,
    imported,
    prompted
  };
}
