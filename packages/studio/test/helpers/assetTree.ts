// Import Third-party Dependencies
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  AssetTreeModel,
  type AssetDependencies,
  type AssetTreeNode
} from "../../src/catalog/AssetTreeModel.ts";

export const COMPANION_RECORDS: AssetRecordData[] = [
  {
    id: "map-overworld",
    kind: "voxelmap",
    source: "maps/overworld.voxelmap.json"
  },
  {
    id: "tileset-overworld",
    kind: "tileset",
    source: "maps/overworld.tileset.json"
  },
  {
    id: "map-cave",
    kind: "voxelmap",
    source: "maps/cave.voxelmap.json"
  },
  {
    id: "model-hero",
    kind: "voxelmodel",
    source: "models/hero.voxelmodel.json"
  },
  {
    id: "texture-hero",
    kind: "pixelart",
    source: "models/hero.pixelart"
  },
  {
    id: "notes-hero",
    kind: "binary",
    source: "models/hero.bin"
  }
];

export const COMPANION_EDGES: Record<string, string[]> = {
  "map-overworld": ["tileset-overworld"],
  "map-cave": ["tileset-overworld"],
  "model-hero": ["texture-hero"]
};

export function shape(
  nodes: AssetTreeNode[]
): unknown[] {
  return nodes.map((node) => (
    node.children === undefined ?
      node.label :
      [node.label, shape(node.children)]
  ));
}

export function dependenciesOf(
  edges: Record<string, string[]>
): AssetDependencies {
  return {
    dependenciesOf: (assetId) => (edges[assetId] ?? []).map(
      (id): AssetReferenceData => {
        return {
          id,
          kind: "any"
        };
      }
    ),
    dependentsOf: (assetId) => Object.keys(edges).filter(
      (dependentId) => edges[dependentId]?.includes(assetId)
    )
  };
}

export function companionModelOf(
  records: AssetRecordData[] = COMPANION_RECORDS,
  edges: Record<string, string[]> = COMPANION_EDGES
): AssetTreeModel {
  return new AssetTreeModel(records, {
    dependencies: dependenciesOf(edges)
  });
}
