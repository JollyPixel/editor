// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  resolveReparentMoves,
  type JollyActivateDetail,
  type JollyActivateSwatchDetail,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type TreeNode
} from "@jolly-pixel/ui";
import type {
  ModelChange,
  ModelDocument,
  VoxelModelCommand
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  findHierarchyNode,
  type HierarchyNode,
  type ModelHierarchy
} from "../../model/index.ts";
import type { ModelBlocks } from "../../scene/index.ts";
import type {
  BlockSelectionStore,
  PresenceStore
} from "../../state/index.ts";
import {
  collectExpandableIds,
  toTreeNodes
} from "./hierarchyTreeNodes.ts";
import {
  BLOCK_MENU,
  FOLDER_MENU,
  ROOT_MENU,
  type HierarchyAction,
  type RootAction
} from "./hierarchyMenu.ts";
import type {
  HierarchyNameContext,
  HierarchyNameResult
} from "./dialogs/HierarchyNameDialog.ts";
import type {
  HierarchyDuplicateContext,
  HierarchyDuplicateResult
} from "./dialogs/HierarchyDuplicateDialog.ts";
import type {
  DeleteContext,
  DeleteResult
} from "../../shared/DeleteDialog.ts";
import { WorkspaceController } from "../../shared/WorkspaceController.ts";
import { ExpandedRows } from "../../shared/ExpandedRows.ts";
import {
  EMPTY_MENU,
  menuSession,
  rowMenuSession,
  type MenuSession
} from "../../shared/menuSession.ts";

export interface HierarchyWorkspace {
  document: ModelDocument;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  hierarchy: ModelHierarchy;
  presence: PresenceStore;
}

export interface HierarchyView {
  promptName(
    context: HierarchyNameContext
  ): Promise<HierarchyNameResult | null>;
  promptDuplicate(
    context: HierarchyDuplicateContext
  ): Promise<HierarchyDuplicateResult | null>;
  promptDelete(
    context: DeleteContext
  ): Promise<DeleteResult | null>;
  beginRename(
    id: string
  ): void;
  showMaterial(): void;
}

export class HierarchyController {
  #host: ReactiveControllerHost;
  #view: HierarchyView;
  #connection: WorkspaceController<HierarchyWorkspace>;
  #nodes: TreeNode[] = [];
  #selected: string[] = [];
  #expanded = new ExpandedRows();

  readonly #rowActions: Record<HierarchyAction, (id: string) => Promise<void> | void> = {
    rename: (id) => this.#view.beginRename(id),
    material: (id) => this.editMaterial(id),
    "add-block": (id) => this.#addBlock(id),
    "add-folder": (id) => this.#addFolder(id),
    duplicate: (id) => this.#duplicate(id),
    delete: (id) => this.#remove(id)
  };

  readonly #rootActions: Record<RootAction, () => Promise<void>> = {
    "add-block": () => this.#addBlock(null),
    "add-folder": () => this.#addFolder(null)
  };

  #onChange = (
    change: ModelChange
  ): void => {
    const parentId = landingParentOf(change.command);
    if (parentId !== null) {
      this.#expanded.expand(parentId);
    }
    this.#rebuild();
  };

  #onReset = (): void => {
    this.#selected = [];
    this.#rebuild();
    this.#expanded.reset(collectExpandableIds(this.#nodes));
  };

  #onSelect = (
    uuid: string | null
  ): void => {
    this.#selected = uuid === null ? [] : [uuid];
    this.#host.requestUpdate();
  };

  #onPeerSelections = (): void => {
    this.#rebuild();
  };

  constructor(
    host: ReactiveControllerHost,
    view: HierarchyView
  ) {
    this.#host = host;
    this.#view = view;
    this.#connection = new WorkspaceController(
      host,
      (workspace) => this.#subscribeTo(workspace)
    );
  }

  get #workspace(): HierarchyWorkspace | null {
    return this.#connection.current;
  }

  get nodes(): TreeNode[] {
    return this.#nodes;
  }

  get selected(): string[] {
    return this.#selected;
  }

  get expanded(): string[] {
    return this.#expanded.ids;
  }

  get hasSelection(): boolean {
    return this.#selected.length > 0;
  }

  attach(
    workspace: HierarchyWorkspace
  ): void {
    this.#connection.attach(workspace);
    this.#onReset();
  }

  readonly handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    this.#selectNodes(event.detail.selected);
  };

  editMaterial(
    id: string
  ): void {
    this.#selectNodes([id]);
    this.#view.showMaterial();
  }

  #selectNodes(
    selected: string[]
  ): void {
    const workspace = this.#workspace;
    const id = selected[0];
    workspace?.selection.select(
      id === undefined ? null : workspace.blocks.get(id)?.uuid ?? null
    );
    this.#selected = selected;
    this.#host.requestUpdate();
  }

  readonly handleToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    this.#expanded.set(event.detail.id, event.detail.expanded);
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
    const moves = resolveReparentMoves({
      nodes: this.#nodes,
      ...event.detail
    });
    for (const { id, parentId, beforeId } of moves) {
      this.#workspace?.hierarchy.move(id, parentId, beforeId);
    }
  };

  readonly addBlock = (): Promise<void> => this.#addBlock(null);

  readonly addFolder = (): Promise<void> => this.#addFolder(null);

  readonly duplicateSelected = async(): Promise<void> => {
    const id = this.#selected[0];
    if (id !== undefined) {
      await this.#duplicate(id);
    }
  };

  readonly deleteSelected = async(): Promise<void> => {
    const id = this.#selected[0];
    if (id !== undefined) {
      await this.#remove(id);
    }
  };

  menuFor(
    id: string | null
  ): MenuSession {
    if (id === null) {
      return menuSession(ROOT_MENU, (action) => this.#rootActions[action]());
    }

    const kind = this.#workspace?.document.tree.get(id)?.kind;
    if (kind === undefined) {
      return EMPTY_MENU;
    }

    return rowMenuSession(
      kind === "block" ? BLOCK_MENU : FOLDER_MENU,
      () => this.#workspace?.document.tree.has(id) === true,
      (action) => this.#rowActions[action](id)
    );
  }

  async #addBlock(
    parentId: string | null
  ): Promise<void> {
    const name = await this.#promptNewName("Block");
    const uuid = name === null ?
      null :
      this.#workspace?.hierarchy.createBlock(name, parentId) ?? null;
    if (uuid !== null) {
      this.#selectNodes([uuid]);
    }
  }

  async #addFolder(
    parentId: string | null
  ): Promise<void> {
    const name = await this.#promptNewName("Folder");
    if (name !== null) {
      this.#workspace?.hierarchy.createFolder(name, parentId);
    }
  }

  async #promptNewName(
    defaultName: string
  ): Promise<string | null> {
    const result = await this.#view.promptName({
      heading: `New ${defaultName}`,
      fieldLabel: `${defaultName} name`,
      defaultName
    });

    return result === null ? null : result.name || defaultName;
  }

  async #duplicate(
    id: string
  ): Promise<void> {
    const source = this.#hierarchyNode(id);
    if (source === null) {
      return;
    }

    const hasChildren = source.children.length > 0;
    const result = await this.#view.promptDuplicate({
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
      this.#expanded.expand(duplicateId);
    }
    this.#selectNodes([duplicateId]);
  }

  async #remove(
    id: string
  ): Promise<void> {
    const source = this.#hierarchyNode(id);
    if (source === null) {
      return;
    }

    const result = await this.#view.promptDelete({
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
    this.#selectNodes([]);
  }

  readonly handleActivate = (
    event: CustomEvent<JollyActivateDetail>
  ): void => {
    const { id } = event.detail;
    if (this.#workspace?.document.tree.get(id)?.kind === "folder") {
      this.#expanded.toggle(id);
      this.#host.requestUpdate();
    }
  };

  readonly handleActivateSwatch = (
    event: CustomEvent<JollyActivateSwatchDetail>
  ): void => {
    this.editMaterial(event.detail.id);
  };

  #hierarchyNode(
    id: string
  ): HierarchyNode | null {
    if (this.#workspace === null) {
      return null;
    }

    return findHierarchyNode(
      this.#workspace.hierarchy.nodes(),
      id
    );
  }

  #subscribeTo(
    workspace: HierarchyWorkspace
  ): Array<() => void> {
    const {
      document,
      selection,
      presence
    } = workspace;

    return [
      document.subscribe("change", this.#onChange),
      document.subscribe("reset", this.#onReset),
      selection.subscribe("select", this.#onSelect),
      presence.subscribe("blockSelectionsChange", this.#onPeerSelections)
    ];
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

function landingParentOf(
  command: VoxelModelCommand
): string | null {
  switch (command.action) {
    case "node-added":
      return command.node.parentId;
    case "node-moved":
      return command.parentId;
    default:
      return null;
  }
}
