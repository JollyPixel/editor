// Import Third-party Dependencies
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";
import type {
  IconName,
  JollyReparentDetail,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetCompanions } from "./AssetCompanions.ts";
import { AssetDeletion } from "./AssetDeletion.ts";
import { AssetPath } from "./AssetPath.ts";
import { AssetPathTakenError } from "./errors/AssetPathTakenError.ts";

// CONSTANTS
const kFolderNodePrefix = "folder:";
const kAssetNodePrefix = "asset:";
const kFolderIcon: IconName = "folder";
const kCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

export interface AssetFolderData {
  type: "folder";
  path: AssetPath;
}

export interface AssetLeafData {
  type: "asset";
  id: string;
  kind: string;
  path: AssetPath;
}

export type AssetNodeData = AssetFolderData | AssetLeafData;

export type AssetTreeNode = TreeNode<AssetNodeData>;

export interface AssetKindPresenter {
  iconFor(kind: string): IconName | undefined;
  detailFor(kind: string): string | undefined;
}

export interface AssetDependencies {
  dependenciesOf(assetId: string): readonly AssetReferenceData[];
  dependentsOf(assetId: string): readonly string[];
}

export interface AssetTreeOptions {
  presenter?: AssetKindPresenter;
  /**
   * Shows only the assets of this kind and their companions; every folder
   * still shows. Folder relocations and deletions cover every asset under them.
   */
  kind?: string | null;
  dependencies?: AssetDependencies;
  folders?: Iterable<AssetPath>;
}

export interface AssetRename {
  assetId: string;
  to: string;
}

export interface AssetRelocation {
  nodeId: string;
  type: AssetNodeData["type"];
  from: AssetPath;
  to: AssetPath;
  renames: AssetRename[];
}

export type AssetDrop = Pick<JollyReparentDetail, "targetId" | "where">;

interface AssetLeaf {
  asset: AssetLeafData;
  node: AssetTreeNode;
}

export function folderNodeId(
  path: AssetPath
): string {
  return `${kFolderNodePrefix}${path}`;
}

export function assetNodeId(
  assetId: string
): string {
  return `${kAssetNodePrefix}${assetId}`;
}

export class AssetTreeModel {
  static readonly EMPTY = new AssetTreeModel([]);

  readonly nodes: AssetTreeNode[];

  #index = new Map<string, AssetTreeNode>();
  #assets = new Map<string, AssetLeafData>();
  #companions: AssetCompanions;
  #dependencies: AssetDependencies | undefined;

  constructor(
    records: Iterable<AssetRecordData>,
    options: AssetTreeOptions = {}
  ) {
    this.nodes = [];
    for (const record of records) {
      this.#assets.set(record.id, {
        type: "asset",
        id: record.id,
        kind: record.kind,
        path: AssetPath.parse(record.source)
      });
    }
    const dependencies = options.dependencies;
    this.#dependencies = dependencies;
    this.#companions = dependencies === undefined ?
      AssetCompanions.EMPTY :
      AssetCompanions.pair(
        this.#assets.values(),
        (assetId) => dependencies.dependenciesOf(assetId)
      );

    const leaves = new Map<string, AssetLeaf>();
    for (const asset of this.#assets.values()) {
      this.#folderAt(asset.path.parent);
      const kinds = [asset.kind, this.#ownerOf(asset.id)?.kind];
      if (!options.kind || kinds.includes(options.kind)) {
        leaves.set(asset.id, {
          asset,
          node: assetNode(asset, options.presenter)
        });
      }
    }
    for (const { asset, node } of leaves.values()) {
      const ownerId = this.#companions.ownerOf(asset.id);
      const owner = ownerId === undefined ?
        undefined :
        leaves.get(ownerId)?.node;
      if (owner === undefined) {
        this.#add(this.#folderAt(asset.path.parent), node);
      }
      else {
        owner.collapsible = false;
        this.#add(owner.children ??= [], node);
      }
    }
    for (const folder of options.folders ?? []) {
      this.#folderAt(folder);
    }
    sortNodes(this.nodes);
  }

  node(
    nodeId: string
  ): AssetTreeNode | undefined {
    return this.#index.get(nodeId);
  }

  has(
    nodeId: string
  ): boolean {
    return this.#index.has(nodeId);
  }

  folderIds(): string[] {
    return folderIdsOf(this.nodes);
  }

  vacantFolder(
    parent: AssetPath,
    name: string
  ): AssetPath {
    let path = parent.child(name);
    for (let index = 2; this.#isTaken(path); index++) {
      path = parent.child(`${name} ${index}`);
    }

    return path;
  }

  deletionOf(
    nodeIds: Iterable<string>
  ): AssetDeletion {
    const targets = [...nodeIds].flatMap(
      (nodeId) => this.#index.get(nodeId)?.data ?? []
    );
    const assets = new Map<string, AssetLeafData>();
    for (const target of targets) {
      for (const asset of this.#assetsUnder(target)) {
        assets.set(asset.id, asset);
      }
    }
    const companions = new Map<string, AssetLeafData>();
    for (const target of targets) {
      if (target.type !== "asset") {
        continue;
      }
      for (const companion of this.#companionsOf(target.id)) {
        if (!assets.has(companion.id)) {
          companions.set(companion.id, companion);
        }
      }
    }

    return new AssetDeletion({
      targets,
      assets: [...assets.values()],
      companions: [...companions.values()],
      dependents: this.#dependentsOf(assets.values()),
      dependentsWithCompanions: this.#dependentsOf([
        ...assets.values(),
        ...companions.values()
      ])
    });
  }

  renameOf(
    nodeId: string,
    name: string
  ): AssetRelocation | null {
    const data = this.#index.get(nodeId)?.data;
    if (data === undefined) {
      return null;
    }

    const to = data.type === "asset" ?
      data.path.withNameKeepingExtension(name) :
      data.path.withName(name);
    if (to.equals(data.path)) {
      return null;
    }

    const relocation = this.#relocate(nodeId, data, to);
    this.#assertVacant([relocation]);

    return relocation;
  }

  dropFolder(
    drop: AssetDrop
  ): AssetPath | null {
    const data = this.#index.get(drop.targetId)?.data;
    if (data === undefined) {
      return null;
    }
    if (drop.where === "inside") {
      return data.type === "folder" ? data.path : null;
    }

    return data.path.parent;
  }

  acceptsDrop(
    detail: JollyReparentDetail
  ): boolean {
    const folder = this.dropFolder(detail);

    return folder !== null &&
      this.#movedData(detail.movedIds).some(
        ([, data]) => this.#canMove(data, folder)
      );
  }

  movesOf(
    detail: JollyReparentDetail
  ): AssetRelocation[] {
    const folder = this.dropFolder(detail);
    if (folder === null) {
      return [];
    }

    const relocations = this.#movedData(detail.movedIds)
      .filter(([, data]) => this.#canMove(data, folder))
      .map(([nodeId, data]) => this.#relocate(
        nodeId,
        data,
        data.path.moveUnder(folder)
      ));
    this.#assertVacant(relocations);

    return relocations;
  }

  withLabels(
    labels: ReadonlyMap<string, string>
  ): AssetTreeNode[] {
    return labels.size === 0
      ? this.nodes
      : relabel(this.nodes, labels);
  }

  #movedData(
    movedIds: readonly string[]
  ): Array<[string, AssetNodeData]> {
    const moved: Array<[string, AssetNodeData]> = [];
    for (const nodeId of movedIds) {
      const data = this.#index.get(nodeId)?.data;
      if (data !== undefined) {
        moved.push([nodeId, data]);
      }
    }

    const movedAssets = new Set(moved.flatMap(
      ([, data]) => (data.type === "asset" ? [data.id] : [])
    ));

    return moved.filter(([, data]) => {
      if (data.type === "asset") {
        const owner = this.#companions.ownerOf(data.id);
        if (owner !== undefined && movedAssets.has(owner)) {
          return false;
        }
      }

      return !moved.some(
        ([, other]) => other.type === "folder" && data.path.isUnder(other.path)
      );
    });
  }

  #canMove(
    data: AssetNodeData,
    folder: AssetPath
  ): boolean {
    if (data.path.parent.equals(folder)) {
      return false;
    }

    return data.type === "asset" ||
      !(folder.equals(data.path) || folder.isUnder(data.path));
  }

  #relocate(
    nodeId: string,
    data: AssetNodeData,
    to: AssetPath
  ): AssetRelocation {
    const renames = this.#assetsUnder(data).map((asset) => {
      return {
        assetId: asset.id,
        to: asset.path.rebase(data.path, to).toString()
      };
    });
    if (data.type === "asset") {
      for (const companion of this.#companionsOf(data.id)) {
        renames.push({
          assetId: companion.id,
          to: to.withName(`${to.stem}${companion.path.extension}`).toString()
        });
      }
    }

    return {
      nodeId,
      type: data.type,
      from: data.path,
      to,
      renames
    };
  }

  #ownerOf(
    assetId: string
  ): AssetLeafData | undefined {
    const ownerId = this.#companions.ownerOf(assetId);

    return ownerId === undefined ? undefined : this.#assets.get(ownerId);
  }

  #assertVacant(
    relocations: readonly AssetRelocation[]
  ): void {
    const renames = relocations.flatMap((relocation) => relocation.renames);
    const moving = new Set(renames.map((rename) => rename.assetId));
    const taken = new Set(
      [...this.#assets.values()]
        .filter((asset) => !moving.has(asset.id))
        .map((asset) => asset.path.toString())
    );
    for (const rename of renames) {
      if (taken.has(rename.to)) {
        throw new AssetPathTakenError(rename.to);
      }
      taken.add(rename.to);
    }
  }

  #isTaken(
    path: AssetPath
  ): boolean {
    return this.#index.has(folderNodeId(path)) ||
      [...this.#assets.values()].some(
        (asset) => asset.path.equals(path) || asset.path.isUnder(path)
      );
  }

  #assetsUnder(
    data: AssetNodeData
  ): AssetLeafData[] {
    if (data.type === "asset") {
      return [data];
    }

    return [...this.#assets.values()].filter(
      (asset) => asset.path.isUnder(data.path)
    );
  }

  #companionsOf(
    ownerId: string
  ): AssetLeafData[] {
    return this.#companions
      .companionsOf(ownerId)
      .flatMap((assetId) => this.#assets.get(assetId) ?? []);
  }

  #dependentsOf(
    assets: Iterable<AssetLeafData>
  ): string[] {
    const deleted = new Set([...assets].map((asset) => asset.id));
    const dependents = new Set<string>();
    for (const assetId of deleted) {
      for (const dependentId of this.#dependencies?.dependentsOf(assetId) ?? []) {
        const dependent = this.#assets.get(dependentId);
        if (dependent !== undefined && !deleted.has(dependentId)) {
          dependents.add(dependent.path.toString());
        }
      }
    }

    return [...dependents].sort();
  }

  #folderAt(
    path: AssetPath
  ): AssetTreeNode[] {
    if (path.isRoot) {
      return this.nodes;
    }

    const id = folderNodeId(path);
    const known = this.#index.get(id);
    if (known?.children !== undefined) {
      return known.children;
    }

    const children: AssetTreeNode[] = [];
    this.#add(this.#folderAt(path.parent), {
      id,
      label: path.name,
      icon: kFolderIcon,
      renamable: true,
      children,
      data: {
        type: "folder",
        path
      }
    });

    return children;
  }

  #add(
    siblings: AssetTreeNode[],
    node: AssetTreeNode
  ): void {
    siblings.push(node);
    this.#index.set(node.id, node);
  }
}

function assetNode(
  data: AssetLeafData,
  presenter: AssetKindPresenter | undefined
): AssetTreeNode {
  return {
    id: assetNodeId(data.id),
    label: data.path.name,
    icon: presenter?.iconFor(data.kind),
    detail: presenter?.detailFor(data.kind),
    renamable: true,
    data
  };
}

function relabel(
  nodes: AssetTreeNode[],
  labels: ReadonlyMap<string, string>
): AssetTreeNode[] {
  return nodes.map((node) => {
    const label = labels.get(node.id) ?? node.label;

    return node.children === undefined ?
      {
        ...node,
        label
      } :
      {
        ...node,
        label,
        children: relabel(node.children, labels)
      };
  });
}

function folderIdsOf(
  nodes: Iterable<AssetTreeNode>
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.data?.type === "folder") {
      ids.push(
        node.id,
        ...folderIdsOf(node.children ?? [])
      );
    }
  }

  return ids;
}

function sortNodes(
  nodes: AssetTreeNode[]
): void {
  nodes.sort(compareNodes);
  for (const node of nodes) {
    if (node.children !== undefined) {
      sortNodes(node.children);
    }
  }
}

function compareNodes(
  left: AssetTreeNode,
  right: AssetTreeNode
): number {
  const leftFolder = left.data?.type === "folder";
  const rightFolder = right.data?.type === "folder";
  if (leftFolder !== rightFolder) {
    return leftFolder ? -1 : 1;
  }

  return kCollator.compare(
    left.label,
    right.label
  );
}
