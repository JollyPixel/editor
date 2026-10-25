// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  AssetPath,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type {
  IconName,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { registerKindIcon } from "../../ui/registerKindIcon.ts";
import { PICKER_FOLDER_ICON } from "./pickerIcons.ts";

// CONSTANTS
const kFolderNodePrefix = "folder:";
const kAssetNodePrefix = "asset:";
const kCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

export type AssetChoicesEvents = {
  change: () => void;
};

export interface AssetChoicesCatalog extends Pick<CatalogClient, "records"> {
  subscribe(
    type: "change",
    listener: () => void
  ): () => void;
}

export type AssetChoiceNode = TreeNode<AssetReferenceData>;

export interface AssetChoicesOptions {
  catalog: AssetChoicesCatalog;
  kinds: Iterable<AssetKindDescriptor>;
  current?: AssetReferenceData | null;
}

interface FolderBranch {
  node: AssetChoiceNode;
  folders: Map<string, FolderBranch>;
  assets: AssetChoiceNode[];
}

export class AssetChoices extends Emitter<AssetChoicesEvents> {
  readonly #catalog: AssetChoicesCatalog;
  readonly #icons: ReadonlyMap<string, IconName | undefined>;
  readonly #collapsed = new Set<string>();
  readonly #unsubscribe: () => void;
  #nodes: AssetChoiceNode[] = [];
  #folders = new Set<string>();
  #assets = new Map<string, AssetReferenceData>();
  #selected: string | null = null;

  constructor(
    options: AssetChoicesOptions
  ) {
    super();

    this.#catalog = options.catalog;
    this.#icons = new Map(
      Array.from(
        options.kinds,
        (descriptor) => [descriptor.kind, registerKindIcon(descriptor)]
      )
    );
    this.#rebuild();

    const { current = null } = options;
    if (current !== null) {
      const nodeId = `${kAssetNodePrefix}${current.id}`;
      this.#selected = this.#assets.has(nodeId) ? nodeId : null;
    }
    this.#unsubscribe = this.#catalog.subscribe("change", () => {
      this.#rebuild();
      if (this.#selected !== null && !this.#has(this.#selected)) {
        this.#selected = null;
      }
      this.emit("change");
    });
  }

  get nodes(): readonly AssetChoiceNode[] {
    return this.#nodes;
  }

  get expanded(): string[] {
    return [...this.#folders].filter((nodeId) => !this.#collapsed.has(nodeId));
  }

  get selected(): string[] {
    return this.#selected === null ? [] : [this.#selected];
  }

  get chosen(): AssetReferenceData | null {
    return this.#selected === null ?
      null :
      this.#assets.get(this.#selected) ?? null;
  }

  select(
    nodeIds: readonly string[]
  ): void {
    const nodeId = nodeIds.at(-1);
    this.#selected = nodeId !== undefined && this.#has(nodeId) ?
      nodeId :
      null;
    this.emit("change");
  }

  toggle(
    nodeId: string,
    expanded: boolean
  ): void {
    if (expanded) {
      this.#collapsed.delete(nodeId);
    }
    else {
      this.#collapsed.add(nodeId);
    }
    this.emit("change");
  }

  activate(
    nodeId: string
  ): AssetReferenceData | null {
    const reference = this.#assets.get(nodeId);
    if (reference !== undefined) {
      this.#selected = nodeId;

      return reference;
    }
    if (this.#folders.has(nodeId)) {
      this.toggle(nodeId, this.#collapsed.has(nodeId));
    }

    return null;
  }

  dispose(): void {
    this.#unsubscribe();
  }

  #has(
    nodeId: string
  ): boolean {
    return this.#assets.has(nodeId) || this.#folders.has(nodeId);
  }

  #rebuild(): void {
    const root: FolderBranch = {
      node: {
        id: kFolderNodePrefix,
        label: ""
      },
      folders: new Map(),
      assets: []
    };
    const assets = new Map<string, AssetReferenceData>();
    for (const record of this.#catalog.records()) {
      if (!this.#icons.has(record.kind)) {
        continue;
      }

      const path = new AssetPath(record.path);
      const reference = Object.freeze({
        id: record.id,
        kind: record.kind
      });
      const nodeId = `${kAssetNodePrefix}${record.id}`;
      assets.set(nodeId, reference);
      ensureFolder(root, path.directory).assets.push({
        id: nodeId,
        label: path.name,
        icon: this.#icons.get(record.kind),
        data: reference
      });
    }

    const folders = new Set<string>();
    this.#assets = assets;
    this.#nodes = toChoiceNodes(root, folders);
    this.#folders = folders;
  }
}

function ensureFolder(
  root: FolderBranch,
  directory: string
): FolderBranch {
  let branch = root;
  let path = "";
  for (const segment of directory.split("/")) {
    if (segment === "") {
      continue;
    }

    path = `${path}${segment}/`;
    let child = branch.folders.get(segment);
    if (child === undefined) {
      child = {
        node: {
          id: `${kFolderNodePrefix}${path}`,
          label: segment,
          icon: PICKER_FOLDER_ICON
        },
        folders: new Map(),
        assets: []
      };
      branch.folders.set(segment, child);
    }
    branch = child;
  }

  return branch;
}

function toChoiceNodes(
  branch: FolderBranch,
  folders: Set<string>
): AssetChoiceNode[] {
  const nested = [...branch.folders.values()]
    .sort((left, right) => kCollator.compare(left.node.label, right.node.label))
    .map((child) => {
      folders.add(child.node.id);

      return {
        ...child.node,
        children: toChoiceNodes(child, folders)
      };
    });
  const assets = branch.assets
    .sort((left, right) => kCollator.compare(left.label, right.label));

  return [...nested, ...assets];
}
