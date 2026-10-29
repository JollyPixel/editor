// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

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
export const TREE_KINDS = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json"
    },
    {
      kind: "voxelmodel",
      label: "Voxel model",
      extension: ".voxelmodel.json",
      convertsFrom: [".vox"]
    },
    {
      kind: "pixelart",
      label: "Pixel art",
      extension: ".pixelart",
      convertsFrom: [".png"]
    }
  ],
  editable: ["voxelmap", "voxelmodel"]
});

export interface TreeViewProbe {
  view: AssetTreeView;
  browserState: BrowserState;
  errors: string[];
  created: string[];
  prompted: string[];
}

export interface TreeViewOptions {
  sharing?: boolean;
  picks?: Array<File | null>;
  kindFilter?: KindFilterSource;
}

export function treeView(
  catalog: FakeTreeCatalog,
  options: TreeViewOptions = {}
): TreeViewProbe {
  const {
    sharing = false,
    picks = [],
    kindFilter = null
  } = options;
  const browserState = new BrowserState(new MemoryStorageAdapter());
  const errors: string[] = [];
  const created: string[] = [];
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
      pickFile: async(accept) => {
        prompted.push(`pick ${accept.join(",")}`);

        return picks.shift() ?? null;
      }
    },
    onChange: () => undefined,
    onError: (message) => errors.push(message),
    onCreated: (nodeId) => created.push(nodeId)
  });

  return {
    view,
    browserState,
    errors,
    created,
    prompted
  };
}
