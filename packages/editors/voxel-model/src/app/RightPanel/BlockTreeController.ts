// Import Third-party Dependencies
import type { ReactiveController, ReactiveControllerHost } from "lit";
import {
  findNode,
  findParentId,
  resolveReparent,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type ModelManager from "../../features/groups/ModelManager.ts";
import type FolderManager from "../../features/folders/FolderManager.ts";
import type { ModelSceneComponent } from "../ModelSceneComponent.ts";
import {
  editorState,
  type ModelEventMap,
  type PresenceStore
} from "../state/index.ts";
import {
  collectTreeNodeIds,
  isFolderNode,
  mergeFolderTree,
  withBlockBadges,
  type FlatBlockPlacement,
  type FlatFolderNode,
  type FlatModelNode
} from "../treeNodes.ts";
import { promptNewBlock } from "./prompts/promptNewBlock.ts";
import { promptNewFolder } from "./prompts/promptNewFolder.ts";
import { promptDuplicate } from "./prompts/promptDuplicate.ts";
import { promptDelete } from "./prompts/promptDelete.ts";
import { anyMirrorAxis } from "../../features/groups/mirrorTransform.ts";

type Host = ReactiveControllerHost & HTMLElement;

export class BlockTreeController implements ReactiveController {
  #host: Host;
  #modelManager: ModelManager | null = null;
  #folderManager: FolderManager | null = null;
  #sceneManager: ModelSceneComponent | null = null;
  #presence: PresenceStore | null = null;
  #unsubscribePresence: (() => void) | null = null;
  #unsubscribeModelEvents: Array<() => void> = [];
  #nodes: TreeNode[] = [];
  #selected: string[] = [];
  #expanded: string[] = [];
  #blockFlatNodes: FlatModelNode[] = [];
  #folderFlatNodes: FlatFolderNode[] = [];
  #placements: FlatBlockPlacement[] = [];
  #syncingFromTreeClick = false;

  constructor(
    host: Host
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    const { modelEvents } = editorState;
    this.#unsubscribeModelEvents = [
      modelEvents.watch("groupCreated", this.#onGroupCreated),
      modelEvents.watch("groupRemoved", this.#onGroupRemoved),
      modelEvents.watch("groupReparented", this.#onGroupReparented),
      modelEvents.watch("groupRenamed", this.#onGroupRenamed),
      modelEvents.watch("groupSelected", this.#onGroupSelected),
      modelEvents.watch("modelSnapshotApplied", this.#onModelSnapshotApplied),
      modelEvents.watch("folderCreated", this.#onFolderCreated),
      modelEvents.watch("folderRemoved", this.#onFolderRemoved),
      modelEvents.watch("folderRenamed", this.#onFolderRenamed),
      modelEvents.watch("folderReparented", this.#onFolderReparented),
      modelEvents.watch("blockPlaced", this.#onBlockPlaced),
      modelEvents.watch("blockUnplaced", this.#onBlockUnplaced),
      modelEvents.watch("folderSnapshotApplied", this.#onFolderSnapshotApplied)
    ];
  }

  hostDisconnected(): void {
    for (const unsubscribe of this.#unsubscribeModelEvents) {
      unsubscribe();
    }
    this.#unsubscribeModelEvents = [];
    this.#unsubscribePresence?.();
    this.#unsubscribePresence = null;
  }

  public setPresence(
    presence: PresenceStore
  ): void {
    this.#unsubscribePresence?.();
    this.#presence = presence;
    this.#unsubscribePresence = presence.watch(
      "blockSelectionsChange",
      () => this.#host.requestUpdate()
    );
  }

  public get nodes(): TreeNode[] {
    return this.#presence === null
      ? this.#nodes
      : withBlockBadges(this.#nodes, this.#presence.blockSelections);
  }

  public get selected(): string[] {
    return this.#selected;
  }

  public get expanded(): string[] {
    return this.#expanded;
  }

  public get hasSelection(): boolean {
    return this.#selected.length > 0;
  }

  public get canDuplicate(): boolean {
    return this.#selected.length > 0;
  }

  public setModelManager(
    modelManager: ModelManager
  ): void {
    this.#modelManager = modelManager;
  }

  public setFolderManager(
    folderManager: FolderManager
  ): void {
    this.#folderManager = folderManager;
  }

  public setSceneManager(
    sceneManager: ModelSceneComponent
  ): void {
    this.#sceneManager = sceneManager;
  }

  public readonly handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    this.#selected = event.detail.selected;
    this.#host.requestUpdate();

    const uuid = this.#selected[0];
    const group = uuid === undefined ? null : this.#modelManager?.getGroupByUUID(uuid) ?? null;

    this.#syncingFromTreeClick = true;
    try {
      this.#modelManager?.selectGroup(group);
      editorState.modelEvents.emit("groupSelected", { group });
    }
    finally {
      this.#syncingFromTreeClick = false;
    }
  };

  public readonly handleToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    const { id, expanded } = event.detail;
    this.#expanded = expanded ?
      [...this.#expanded, id] :
      this.#expanded.filter((expandedId) => expandedId !== id);
    this.#host.requestUpdate();
  };

  public readonly handleRename = (
    event: CustomEvent<JollyRenameDetail>
  ): void => {
    const { id, name } = event.detail;
    if (this.#isFolder(id)) {
      this.#folderManager?.renameFolder(id, name);

      return;
    }
    this.#modelManager?.renameGroup(id, name);
  };

  public readonly handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const { movedIds, targetId, where } = event.detail;
    const nextNodes = resolveReparent({
      nodes: this.#nodes,
      movedIds,
      targetId,
      where
    });
    if (nextNodes === this.#nodes) {
      return;
    }

    for (const movedId of movedIds) {
      this.#applyUiParent(movedId, findParentId(nextNodes, movedId) ?? null);
    }

    if (where === "inside" && !this.#expanded.includes(targetId)) {
      this.#expanded = [...this.#expanded, targetId];
      this.#host.requestUpdate();
    }
  };

  public readonly addBlock = (): void => {
    void this.#promptAddBlock();
  };

  public readonly addFolder = (): void => {
    void this.#promptAddFolder();
  };

  public readonly duplicateSelected = (): void => {
    void this.#promptAndDuplicate();
  };

  public readonly deleteSelected = (): void => {
    void this.#promptAndDelete();
  };

  #isFolder(
    id: string
  ): boolean {
    const node = findNode(this.#nodes, id);

    return node !== null && isFolderNode(node);
  }

  #applyUiParent(
    id: string,
    uiParentId: string | null
  ): void {
    if (this.#isFolder(id)) {
      this.#folderManager?.reparentFolder(id, uiParentId);
      this.#resyncPlacedBlocksUnder(id);

      return;
    }

    const parentIsFolder = uiParentId !== null && this.#isFolder(uiParentId);
    const physicalParentId = this.#folderManager?.resolveNearestNonFolderAncestor(uiParentId) ??
      uiParentId;

    this.#modelManager?.reparent(id, physicalParentId);
    this.#folderManager?.placeBlock(id, parentIsFolder ? uiParentId : null);
  }

  #resyncPlacedBlocksUnder(
    folderId: string
  ): void {
    const folderManager = this.#folderManager;
    if (!folderManager) {
      return;
    }

    const subtreeFolderIds = folderManager.collectFolderSubtreeIds(folderId);
    for (const [blockUuid, placedFolderId] of folderManager.getPlacements()) {
      if (subtreeFolderIds.has(placedFolderId)) {
        this.#modelManager?.reparent(
          blockUuid,
          folderManager.resolveNearestNonFolderAncestor(placedFolderId)
        );
      }
    }
  }

  async #promptAddBlock(): Promise<void> {
    const parentId = this.#selected[0] ?? null;

    this.#sceneManager?.setControlsEnabled(false);
    const result = await promptNewBlock({ offerAddAsChild: parentId !== null });
    this.#sceneManager?.setControlsEnabled(true);

    if (result === null) {
      return;
    }

    this.#createBlockWithName(
      result.name || "Block",
      result.addAsChild ? parentId : null
    );
  }

  #createBlockWithName(
    name: string,
    parentId: string | null
  ): void {
    editorState.modelEvents.emit("addblock", { name, parentId });
  }

  async #promptAddFolder(): Promise<void> {
    const parentId = this.#selected[0] ?? null;

    this.#sceneManager?.setControlsEnabled(false);
    const result = await promptNewFolder({ offerAddAsChild: parentId !== null });
    this.#sceneManager?.setControlsEnabled(true);

    if (result === null) {
      return;
    }

    this.#sceneManager?.createFolder(
      result.name || "Folder",
      result.addAsChild ? parentId : null
    );
  }

  async #promptAndDuplicate(): Promise<void> {
    const sourceId = this.#selected[0];
    if (sourceId === undefined) {
      return;
    }

    const sourceNode = findNode(this.#nodes, sourceId);
    if (sourceNode === null) {
      return;
    }

    const hasChildren = (sourceNode.children?.length ?? 0) > 0;

    this.#sceneManager?.setControlsEnabled(false);
    const result = await promptDuplicate({ hasChildren });
    this.#sceneManager?.setControlsEnabled(true);

    if (result === null) {
      return;
    }

    const parentId = findParentId(this.#nodes, sourceId) ?? null;
    const duplicatedBlockIds: string[] = [];
    const uuid = this.#duplicateNode(sourceNode, parentId, {
      label: `${sourceNode.label} Copy`,
      includeChildren: result.includeChildren
    }, duplicatedBlockIds);
    if (uuid === null) {
      return;
    }

    if (anyMirrorAxis(result.mirrorAxes)) {
      this.#modelManager?.mirrorGroups(duplicatedBlockIds, result.mirrorAxes);
    }

    if (result.includeChildren && hasChildren && !this.#expanded.includes(uuid)) {
      this.#expanded = [...this.#expanded, uuid];
    }
    this.#selected = [uuid];
    this.#host.requestUpdate();

    const newGroup = this.#modelManager?.getGroupByUUID(uuid) ?? null;
    this.#syncingFromTreeClick = true;
    try {
      this.#modelManager?.selectGroup(newGroup);
      editorState.modelEvents.emit("groupSelected", { group: newGroup });
    }
    finally {
      this.#syncingFromTreeClick = false;
    }
  }

  #duplicateNode(
    node: TreeNode,
    uiParentId: string | null,
    options: { label?: string; includeChildren: boolean; },
    duplicatedBlockIds: string[]
  ): string | null {
    const label = options.label ?? node.label;
    const isFolder = isFolderNode(node);
    const resultId = isFolder ?
      this.#duplicateFolder(label, uiParentId) :
      this.#duplicateBlock(node.id, label, uiParentId);

    if (resultId !== null && !isFolder) {
      duplicatedBlockIds.push(resultId);
    }

    if (resultId !== null && options.includeChildren) {
      for (const child of node.children ?? []) {
        this.#duplicateNode(child, resultId, { includeChildren: true }, duplicatedBlockIds);
      }
    }

    return resultId;
  }

  #duplicateFolder(
    label: string,
    uiParentId: string | null
  ): string | null {
    return this.#folderManager?.addFolder({ name: label, parentId: uiParentId }) ?? null;
  }

  #duplicateBlock(
    sourceId: string,
    label: string,
    uiParentId: string | null
  ): string | null {
    if (!this.#modelManager) {
      return null;
    }

    const duplicateGroup = this.#modelManager.duplicateGroup(sourceId, label);
    if (!duplicateGroup) {
      return null;
    }

    const uuid = duplicateGroup.getGroupUUID();
    const parentIsFolder = uiParentId !== null && this.#isFolder(uiParentId);
    const physicalParentId = this.#folderManager?.resolveNearestNonFolderAncestor(uiParentId) ??
      uiParentId;

    this.#modelManager.reparentLocal(uuid, physicalParentId);
    if (parentIsFolder) {
      this.#folderManager?.placeBlock(uuid, uiParentId);
    }

    return uuid;
  }

  async #promptAndDelete(): Promise<void> {
    const sourceId = this.#selected[0];
    if (sourceId === undefined) {
      return;
    }

    const sourceNode = findNode(this.#nodes, sourceId);
    if (sourceNode === null) {
      return;
    }

    const isFolder = isFolderNode(sourceNode);
    const hasChildren = (sourceNode.children?.length ?? 0) > 0;

    this.#sceneManager?.setControlsEnabled(false);
    const result = await promptDelete({
      hasChildren,
      heading: isFolder ? "Delete Folder" : "Delete Block"
    });
    this.#sceneManager?.setControlsEnabled(true);

    if (result === null) {
      return;
    }

    if (result.deleteChildren) {
      this.#removeSubtree(sourceNode);
    }
    else {
      this.#promoteChildrenThenRemove(sourceNode);
    }

    this.#selected = [];
    this.#host.requestUpdate();
    this.#modelManager?.selectGroup(null);
    editorState.modelEvents.emit("groupSelected", { group: null });
  }

  #removeSubtree(
    node: TreeNode
  ): void {
    const ids = collectTreeNodeIds(node);
    const blockIds = ids.filter((id) => !this.#isFolder(id));
    const folderIds = ids.filter((id) => this.#isFolder(id));

    if (blockIds.length > 0) {
      editorState.modelEvents.emit("deleteblock", { uuids: blockIds });
    }
    for (const folderId of folderIds) {
      this.#sceneManager?.removeFolder(folderId);
    }
  }

  #promoteChildrenThenRemove(
    node: TreeNode
  ): void {
    const parentId = findParentId(this.#nodes, node.id) ?? null;
    for (const child of node.children ?? []) {
      this.#applyUiParent(child.id, parentId);
    }

    if (isFolderNode(node)) {
      this.#sceneManager?.removeFolder(node.id);

      return;
    }

    for (const descendantId of collectTreeNodeIds(node)) {
      if (
        descendantId !== node.id &&
        !this.#isFolder(descendantId) &&
        this.#modelManager?.getParentUUID(descendantId) === node.id
      ) {
        this.#modelManager.reparent(descendantId, parentId);
      }
    }

    editorState.modelEvents.emit("deleteblock", { uuids: [node.id] });
  }

  /**
   * `#blockFlatNodes` / `#folderFlatNodes` / `#placements` are the single
   * source of truth for the tree; every handler below edits one of them and
   * re-derives `#nodes` through `#rebuildTree`, rather than hand-splicing
   * the rendered tree directly. That keeps a later snapshot rebuild from
   * ever reverting an edit no one remembered to mirror into a parallel cache.
   */
  readonly #onGroupCreated: ModelEventMap["groupCreated"] = (
    { group, name, parentId }
  ) => {
    this.#blockFlatNodes = [
      ...this.#blockFlatNodes,
      { uuid: group.getGroupUUID(), name: name || "Block", parentUuid: parentId ?? null }
    ];
    this.#expandParent(parentId ?? null);
    this.#rebuildTree();
  };

  readonly #onGroupRemoved: ModelEventMap["groupRemoved"] = (
    { uuid }
  ) => {
    this.#blockFlatNodes = this.#blockFlatNodes.filter((node) => node.uuid !== uuid);
    this.#rebuildTree();
  };

  readonly #onGroupReparented: ModelEventMap["groupReparented"] = (
    { uuid, parentUuid }
  ) => {
    this.#blockFlatNodes = this.#blockFlatNodes.map((node) => (
      node.uuid === uuid ? { ...node, parentUuid } : node
    ));
    this.#expandParent(parentUuid);
    this.#rebuildTree();
  };

  readonly #onGroupRenamed: ModelEventMap["groupRenamed"] = (
    { uuid, name }
  ) => {
    this.#blockFlatNodes = this.#blockFlatNodes.map((node) => (
      node.uuid === uuid ? { ...node, name } : node
    ));
    this.#rebuildTree();
  };

  readonly #onGroupSelected: ModelEventMap["groupSelected"] = (
    { group }
  ) => {
    if (this.#syncingFromTreeClick) {
      return;
    }

    const uuid = group ? group.getGroupUUID() : null;
    this.#selected = uuid ? [uuid] : [];
    this.#host.requestUpdate();
  };

  readonly #onModelSnapshotApplied: ModelEventMap["modelSnapshotApplied"] = (
    { nodes }
  ) => {
    this.#blockFlatNodes = nodes;
    this.#selected = [];
    this.#rebuildTree();
  };

  readonly #onFolderCreated: ModelEventMap["folderCreated"] = (
    { uuid, name, parentId }
  ) => {
    this.#folderFlatNodes = [...this.#folderFlatNodes, { uuid, name, parentId }];
    this.#expandParent(parentId);
    this.#rebuildTree();
  };

  readonly #onFolderRemoved: ModelEventMap["folderRemoved"] = (
    { uuid }
  ) => {
    this.#folderFlatNodes = this.#folderFlatNodes.filter((folder) => folder.uuid !== uuid);
    this.#rebuildTree();
  };

  readonly #onFolderRenamed: ModelEventMap["folderRenamed"] = (
    { uuid, name }
  ) => {
    this.#folderFlatNodes = this.#folderFlatNodes.map((folder) => (
      folder.uuid === uuid ? { ...folder, name } : folder
    ));
    this.#rebuildTree();
  };

  readonly #onFolderReparented: ModelEventMap["folderReparented"] = (
    { uuid, parentId }
  ) => {
    this.#folderFlatNodes = this.#folderFlatNodes.map((folder) => (
      folder.uuid === uuid ? { ...folder, parentId } : folder
    ));
    this.#expandParent(parentId);
    this.#rebuildTree();
  };

  readonly #onBlockPlaced: ModelEventMap["blockPlaced"] = (
    { blockUuid, folderId }
  ) => {
    this.#placements = [
      ...this.#placements.filter((placement) => placement.blockUuid !== blockUuid),
      { blockUuid, folderId }
    ];
    this.#expandParent(folderId);
    this.#rebuildTree();
  };

  readonly #onBlockUnplaced: ModelEventMap["blockUnplaced"] = (
    { blockUuid }
  ) => {
    this.#placements = this.#placements.filter((placement) => placement.blockUuid !== blockUuid);
    this.#rebuildTree();
  };

  readonly #onFolderSnapshotApplied: ModelEventMap["folderSnapshotApplied"] = (
    { folders, placements }
  ) => {
    this.#folderFlatNodes = folders;
    this.#placements = placements;
    this.#selected = [];
    this.#rebuildTree();
  };

  #expandParent(
    parentId: string | null
  ): void {
    if (parentId !== null && !this.#expanded.includes(parentId)) {
      this.#expanded = [...this.#expanded, parentId];
    }
  }

  #rebuildTree(): void {
    this.#nodes = mergeFolderTree(this.#blockFlatNodes, this.#folderFlatNodes, this.#placements);
    this.#host.requestUpdate();
  }
}
