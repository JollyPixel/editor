// Import Third-party Dependencies
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";
import {
  CATALOG_PLAN,
  CatalogRejectedError,
  type CatalogBatchReport,
  type CatalogCreateOptions,
  type CatalogRename,
  type ImportPlan,
  type ImportReport
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  AssetTreeModel,
  type AssetDependencies,
  type AssetTreeNode
} from "../../src/catalog/AssetTreeModel.ts";
import type {
  AssetTreeCatalog,
  AssetTreeCatalogEvent
} from "../../src/shell/assets/AssetTreeView.ts";

export const COMPANION_RECORDS: AssetRecordData[] = [
  {
    id: "map-overworld",
    kind: "voxelmap",
    path: "maps/overworld.voxelmap.json"
  },
  {
    id: "blockset-overworld",
    kind: "blockset",
    path: "maps/overworld.blockset.json"
  },
  {
    id: "map-cave",
    kind: "voxelmap",
    path: "maps/cave.voxelmap.json"
  },
  {
    id: "model-hero",
    kind: "voxelmodel",
    path: "models/hero.voxelmodel.json"
  },
  {
    id: "texture-hero",
    kind: "pixelart",
    path: "models/hero.pixelart"
  },
  {
    id: "notes-hero",
    kind: "binary",
    path: "models/hero.bin"
  }
];

export const COMPANION_EDGES: Record<string, string[]> = {
  "map-overworld": ["blockset-overworld"],
  "map-cave": ["blockset-overworld"],
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

export function createDependencies(
  edges: Record<string, string[]>
): AssetDependencies {
  return {
    listDependencies: (assetId) => (edges[assetId] ?? []).map(
      (id): AssetReferenceData => {
        return {
          id,
          kind: "any"
        };
      }
    ),
    listDependents: (assetId) => Object.keys(edges).filter(
      (dependentId) => edges[dependentId]?.includes(assetId)
    )
  };
}

export function createCompanionModel(
  records: AssetRecordData[] = COMPANION_RECORDS,
  edges: Record<string, string[]> = COMPANION_EDGES
): AssetTreeModel {
  return new AssetTreeModel(records, {
    dependencies: createDependencies(edges)
  });
}

export function findLabel(
  nodes: readonly AssetTreeNode[],
  nodeId: string
): string | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node.label;
    }

    const label = findLabel(node.children ?? [], nodeId);
    if (label !== undefined) {
      return label;
    }
  }

  return undefined;
}

export class FakeTreeCatalog implements AssetTreeCatalog {
  readonly dependencies = createDependencies({});
  readonly byId = new Map<string, AssetRecordData>();
  readonly folderPaths: Set<string>;
  failure: string | null = null;
  #created = 0;
  #staged: Array<() => void> = [];
  #listeners = new Map<AssetTreeCatalogEvent, Set<() => void>>();

  constructor(
    records: Iterable<AssetRecordData>,
    folders: Iterable<string> = []
  ) {
    for (const record of records) {
      this.byId.set(record.id, record);
    }
    this.folderPaths = new Set(folders);
  }

  records(): Iterable<AssetRecordData> {
    return this.byId.values();
  }

  folders(): Iterable<string> {
    return this.folderPaths;
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.byId.get(assetId);
  }

  on(
    event: AssetTreeCatalogEvent,
    listener: () => void
  ): void {
    const listeners = this.#listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(event, listeners);
  }

  off(
    event: AssetTreeCatalogEvent,
    listener: () => void
  ): void {
    this.#listeners.get(event)?.delete(listener);
  }

  change(): void {
    for (const apply of this.#staged.splice(0)) {
      apply();
    }
    for (const listener of this.#listeners.get("change") ?? []) {
      listener();
    }
  }

  async create(
    path: string,
    _content: Uint8Array | null,
    options: CatalogCreateOptions = {}
  ): Promise<string> {
    const id = `created-${++this.#created}`;
    this.#staged.push(() => this.byId.set(id, {
      id,
      kind: options.kind ?? "binary",
      path
    }));

    return id;
  }

  async renameMany(
    renames: Iterable<CatalogRename>
  ): Promise<CatalogBatchReport> {
    if (this.failure !== null) {
      return {
        applied: 0,
        failure: this.failure
      };
    }

    const applied = [...renames];
    this.#staged.push(() => {
      for (const { assetId, to } of applied) {
        const record = this.byId.get(assetId);
        if (record !== undefined) {
          this.byId.set(assetId, {
            ...record,
            path: to
          });
        }
      }
    });

    return { applied: applied.length };
  }

  async removeMany(
    assetIds: Iterable<string>
  ): Promise<CatalogBatchReport> {
    const removed = [...assetIds];
    this.#staged.push(() => {
      for (const assetId of removed) {
        this.byId.delete(assetId);
      }
    });

    return { applied: removed.length };
  }

  async createFolder(
    path: string
  ): Promise<string> {
    this.#staged.push(() => this.folderPaths.add(path));

    return path;
  }

  async moveFolder(
    from: string,
    to: string
  ): Promise<string> {
    this.#staged.push(() => {
      for (const folder of [...this.folderPaths]) {
        if (folder === from || folder.startsWith(`${from}/`)) {
          this.folderPaths.delete(folder);
          this.folderPaths.add(to + folder.slice(from.length));
        }
      }
    });

    return to;
  }

  async removeFolder(
    path: string
  ): Promise<void> {
    this.#staged.push(() => this.folderPaths.delete(path));
  }

  async exportArchive(): Promise<Uint8Array> {
    return new Uint8Array();
  }

  async planImport(): Promise<ImportPlan> {
    throw new CatalogRejectedError("not an asset archive", CATALOG_PLAN);
  }

  async importArchive(): Promise<ImportReport> {
    throw new Error("not an asset archive");
  }
}
