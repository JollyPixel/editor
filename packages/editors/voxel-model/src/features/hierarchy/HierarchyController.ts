// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  findParentId,
  resolveReparent,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type TreeNode
} from "@jolly-pixel/ui";
import type { VoxelModelCommand } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  findHierarchyNode,
  type HierarchyNode,
  type ModelBlock,
  type ModelChange,
  type ModelDocument,
  type ModelHierarchy
} from "../../model/index.ts";
import type { PresenceStore } from "../../state/index.ts";
import {
  collectExpandableIds,
  toTreeNodes
} from "./hierarchyTreeNodes.ts";
import type {
  HierarchyNameContext,
  HierarchyNameResult
} from "./dialogs/HierarchyNameDialog.ts";
import type {
  HierarchyDuplicateContext,
  HierarchyDuplicateResult
} from "./dialogs/HierarchyDuplicateDialog.ts";
import type {
  HierarchyDeleteContext,
  HierarchyDeleteResult
} from "./dialogs/HierarchyDeleteDialog.ts";

export interface HierarchyWorkspace {
  document: ModelDocument;
  hierarchy: ModelHierarchy;
  presence: PresenceStore;
}

export interface HierarchyDialogs {
  promptName(
    context: HierarchyNameContext
  ): Promise<HierarchyNameResult | null>;
  promptDuplicate(
    context: HierarchyDuplicateContext
  ): Promise<HierarchyDuplicateResult | null>;
  promptDelete(
    context: HierarchyDeleteContext
  ): Promise<HierarchyDeleteResult | null>;
}

export class HierarchyController implements ReactiveController {
  #host: ReactiveControllerHost;
  #dialogs: HierarchyDialogs;
  #workspace: HierarchyWorkspace | null = null;
  #subscriptions: Array<() => void> = [];
  #nodes: TreeNode[] = [];
  #selected: string[] = [];
  #expanded: string[] = [];

  #onChange = (
    change: ModelChange
  ): void => {
    const parentId = expandedParentOf(change.command);
    if (parentId !== null) {
      this.#expand(parentId);
    }
    this.#rebuild();
  };

  #onReset = (): void => {
    this.#selected = [];
    this.#rebuild();
    this.#expanded = collectExpandableIds(this.#nodes);
  };

  #onSelect = (
    block: ModelBlock | null
  ): void => {
    this.#selected = block ? [block.uuid] : [];
    this.#host.requestUpdate();
  };

  #onPeerSelections = (): void => {
    this.#rebuild();
  };

  constructor(
    host: ReactiveControllerHost,
    dialogs: HierarchyDialogs
  ) {
    this.#host = host;
    this.#dialogs = dialogs;
    host.addController(this);
  }

  get nodes(): TreeNode[] {
    return this.#nodes;
  }

  get selected(): string[] {
    return this.#selected;
  }

  get expanded(): string[] {
    return this.#expanded;
  }

  get hasSelection(): boolean {
    return this.#selected.length > 0;
  }

  attach(
    workspace: HierarchyWorkspace
  ): void {
    this.#unsubscribe();
    this.#workspace = workspace;
    this.#subscribe();
    this.#rebuild();
  }

  hostConnected(): void {
    this.#subscribe();
  }

  hostDisconnected(): void {
    this.#unsubscribe();
  }

  readonly handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    const { selected } = event.detail;
    const blocks = this.#workspace?.document.blocks;
    const uuid = selected[0];

    blocks?.select(
      uuid === undefined ? null : blocks.get(uuid) ?? null
    );
    this.#selected = selected;
    this.#host.requestUpdate();
  };

  readonly handleToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    const { id, expanded } = event.detail;
    this.#expanded = expanded ?
      [...this.#expanded, id] :
      this.#expanded.filter((expandedId) => expandedId !== id);
    this.#host.requestUpdate();
  };

  readonly handleRename = (
    event: CustomEvent<JollyRenameDetail>
  ): void => {
    this.#workspace?.hierarchy.rename(
      event.detail.id,
      event.detail.name
    );
  };

  readonly handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const hierarchy = this.#workspace?.hierarchy;
    const { movedIds, targetId, where } = event.detail;
    const nextNodes = resolveReparent({
      nodes: this.#nodes,
      movedIds,
      targetId,
      where
    });
    if (!hierarchy || nextNodes === this.#nodes) {
      return;
    }

    for (const movedId of movedIds) {
      hierarchy.move(
        movedId,
        findParentId(nextNodes, movedId) ?? null
      );
    }

    if (where === "inside") {
      this.#expand(targetId);
      this.#host.requestUpdate();
    }
  };

  readonly addBlock = async(): Promise<void> => {
    const parentId = this.#selected[0] ?? null;
    const result = await this.#dialogs.promptName({
      heading: "New Block",
      fieldLabel: "Block name",
      defaultName: "Block",
      offerAddAsChild: parentId !== null
    });
    if (result !== null) {
      this.#workspace?.hierarchy.createBlock(
        result.name || "Block",
        result.addAsChild ? parentId : null
      );
    }
  };

  readonly addFolder = async(): Promise<void> => {
    const parentId = this.#selected[0] ?? null;
    const result = await this.#dialogs.promptName({
      heading: "New Folder",
      fieldLabel: "Folder name",
      defaultName: "Folder",
      offerAddAsChild: parentId !== null
    });
    if (result !== null) {
      this.#workspace?.hierarchy.createFolder(
        result.name || "Folder",
        result.addAsChild ? parentId : null
      );
    }
  };

  readonly duplicateSelected = async(): Promise<void> => {
    const source = this.#selectedHierarchyNode();
    if (source === null) {
      return;
    }

    const hasChildren = source.children.length > 0;
    const result = await this.#dialogs.promptDuplicate({
      hasChildren
    });
    const workspace = this.#workspace;
    if (result === null || workspace === null) {
      return;
    }

    const duplicateId = workspace.hierarchy.duplicate(
      source.id,
      result
    );
    if (duplicateId === null) {
      return;
    }

    if (result.includeChildren && hasChildren) {
      this.#expand(duplicateId);
    }
    workspace.document.blocks.select(
      workspace.document.blocks.get(duplicateId) ?? null
    );
    this.#selected = [duplicateId];
    this.#host.requestUpdate();
  };

  readonly deleteSelected = async(): Promise<void> => {
    const source = this.#selectedHierarchyNode();
    if (source === null) {
      return;
    }

    const result = await this.#dialogs.promptDelete({
      heading: source.kind === "folder"
        ? "Delete Folder"
        : "Delete Block",
      hasChildren: source.children.length > 0
    });
    const workspace = this.#workspace;
    if (result === null || workspace === null) {
      return;
    }

    workspace.hierarchy.remove(
      source.id,
      { withChildren: result.deleteChildren }
    );
    workspace.document.blocks.select(null);
  };

  #selectedHierarchyNode(): HierarchyNode | null {
    const sourceId = this.#selected[0];
    if (
      sourceId === undefined ||
      this.#workspace === null
    ) {
      return null;
    }

    return findHierarchyNode(
      this.#workspace.hierarchy.nodes(),
      sourceId
    );
  }

  #subscribe(): void {
    const workspace = this.#workspace;
    if (
      workspace === null ||
      this.#subscriptions.length > 0
    ) {
      return;
    }

    const { document, presence } = workspace;
    document.on("change", this.#onChange);
    document.on("reset", this.#onReset);
    document.blocks.on("select", this.#onSelect);
    this.#subscriptions = [
      () => document.off("change", this.#onChange),
      () => document.off("reset", this.#onReset),
      () => document.blocks.off("select", this.#onSelect),
      presence.subscribe(
        "blockSelectionsChange",
        this.#onPeerSelections
      )
    ];
  }

  #unsubscribe(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  #expand(
    id: string
  ): void {
    if (!this.#expanded.includes(id)) {
      this.#expanded = [...this.#expanded, id];
    }
  }

  #rebuild(): void {
    const workspace = this.#workspace;
    if (workspace !== null) {
      this.#nodes = toTreeNodes(
        workspace.hierarchy.nodes(),
        workspace.presence.blockSelections
      );
    }
    this.#host.requestUpdate();
  }
}

function expandedParentOf(
  command: VoxelModelCommand
): string | null {
  switch (command.action) {
    case "group-reparented":
    case "group-reparented-local":
      return command.parentUuid;
    case "folder-added":
    case "folder-reparented":
      return command.parentId;
    case "block-placed":
      return command.folderId;
    default:
      return null;
  }
}
