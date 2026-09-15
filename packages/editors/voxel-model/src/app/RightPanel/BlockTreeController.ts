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
import type GroupManager from "../../features/groups/GroupManager.ts";
import type { ModelSceneComponent } from "../ModelSceneComponent.ts";
import type { PresenceStore } from "../state/index.ts";
import {
  buildTreeFromFlatNodes,
  collectTreeNodeIds,
  insertChildTreeNode,
  relabelTreeNode,
  removeTreeNode,
  withBlockBadges,
  type FlatModelNode
} from "../treeNodes.ts";
import { promptNewBlock } from "./prompts/promptNewBlock.ts";
import { promptDuplicate } from "./prompts/promptDuplicate.ts";
import { promptDelete } from "./prompts/promptDelete.ts";

type Host = ReactiveControllerHost & HTMLElement;

interface GroupRemovedDetail {
  uuid: string;
}

interface GroupReparentedDetail {
  uuid: string;
  parentUuid: string | null;
}

interface GroupRenamedDetail {
  uuid: string;
  name: string;
}

export class BlockTreeController implements ReactiveController {
  #host: Host;
  #modelManager: ModelManager | null = null;
  #sceneManager: ModelSceneComponent | null = null;
  #presence: PresenceStore | null = null;
  #unsubscribePresence: (() => void) | null = null;
  #nodes: TreeNode[] = [];
  #selected: string[] = [];
  #expanded: string[] = [];

  constructor(
    host: Host
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    document.addEventListener("groupCreated", this.#onGroupCreated);
    document.addEventListener("groupRemoved", this.#onGroupRemoved);
    document.addEventListener("groupReparented", this.#onGroupReparented);
    document.addEventListener("groupRenamed", this.#onGroupRenamed);
    document.addEventListener("groupSelected", this.#onGroupSelected);
    document.addEventListener("modelSnapshotApplied", this.#onModelSnapshotApplied);
  }

  hostDisconnected(): void {
    document.removeEventListener("groupCreated", this.#onGroupCreated);
    document.removeEventListener("groupRemoved", this.#onGroupRemoved);
    document.removeEventListener("groupReparented", this.#onGroupReparented);
    document.removeEventListener("groupRenamed", this.#onGroupRenamed);
    document.removeEventListener("groupSelected", this.#onGroupSelected);
    document.removeEventListener("modelSnapshotApplied", this.#onModelSnapshotApplied);
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

  public setModelManager(
    modelManager: ModelManager
  ): void {
    this.#modelManager = modelManager;
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

    if (this.#selected.length === 0) {
      this.#modelManager?.selectGroup(null);
      this.#dispatchGroupSelected(null);

      return;
    }

    if (!this.#modelManager) {
      return;
    }

    const group = this.#modelManager.getGroupByUUID(this.#selected[0]);
    if (group) {
      this.#modelManager.selectGroup(group);
      this.#dispatchGroupSelected(group);
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
    this.#modelManager?.renameGroup(id, name);
  };

  public readonly handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const { movedIds, targetId, where } = event.detail;
    const nextNodes = resolveReparent({ nodes: this.#nodes, movedIds, targetId, where });
    if (nextNodes === this.#nodes) {
      return;
    }

    for (const movedId of movedIds) {
      this.#modelManager?.reparent(movedId, findParentId(nextNodes, movedId) ?? null);
    }

    if (where === "inside" && !this.#expanded.includes(targetId)) {
      this.#expanded = [...this.#expanded, targetId];
      this.#host.requestUpdate();
    }
  };

  public readonly addBlock = (): void => {
    void this.#promptAddBlock();
  };

  public readonly duplicateSelected = (): void => {
    void this.#promptAndDuplicate();
  };

  public readonly deleteSelected = (): void => {
    void this.#promptAndDelete();
  };

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
    const event = new CustomEvent("addblock", {
      detail: { name, parentId },
      bubbles: true,
      composed: true
    });
    this.#host.dispatchEvent(event);
  }

  async #promptAndDuplicate(): Promise<void> {
    const sourceId = this.#selected[0];
    if (sourceId === undefined || !this.#modelManager) {
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
    const uuid = this.#duplicateSubtree(
      sourceNode,
      result.includeChildren,
      `${sourceNode.label} Copy`,
      parentId
    );
    if (uuid === null) {
      return;
    }

    if (result.includeChildren && hasChildren && !this.#expanded.includes(uuid)) {
      this.#expanded = [...this.#expanded, uuid];
    }
    this.#selected = [uuid];
    this.#host.requestUpdate();

    const newGroup = this.#modelManager.getGroupByUUID(uuid) ?? null;
    this.#modelManager.selectGroup(newGroup);
    this.#dispatchGroupSelected(newGroup);
  }

  #duplicateSubtree(
    node: TreeNode,
    includeChildren: boolean,
    label: string,
    parentId: string | null
  ): string | null {
    if (!this.#modelManager) {
      return null;
    }

    const duplicateGroup = this.#modelManager.duplicateGroup(node.id, label);
    if (!duplicateGroup) {
      return null;
    }

    const uuid = duplicateGroup.getGroupUUID();
    this.#modelManager.reparentLocal(uuid, parentId);

    if (includeChildren) {
      for (const child of node.children ?? []) {
        this.#duplicateSubtree(child, true, child.label, uuid);
      }
    }

    return uuid;
  }

  async #promptAndDelete(): Promise<void> {
    const sourceId = this.#selected[0];
    if (sourceId === undefined || !this.#modelManager) {
      return;
    }

    const sourceNode = findNode(this.#nodes, sourceId);
    if (sourceNode === null) {
      return;
    }

    const hasChildren = (sourceNode.children?.length ?? 0) > 0;

    this.#sceneManager?.setControlsEnabled(false);
    const result = await promptDelete({ hasChildren });
    this.#sceneManager?.setControlsEnabled(true);

    if (result === null) {
      return;
    }

    const removedUuids = result.deleteChildren ?
      collectTreeNodeIds(sourceNode) :
      this.#promoteChildren(sourceNode);

    this.#selected = [];
    this.#host.requestUpdate();
    this.#modelManager.selectGroup(null);
    this.#dispatchGroupSelected(null);

    const event = new CustomEvent("deleteblock", {
      detail: { uuids: removedUuids },
      bubbles: true,
      composed: true
    });
    this.#host.dispatchEvent(event);
  }

  #promoteChildren(
    node: TreeNode
  ): string[] {
    if (!this.#modelManager) {
      return [];
    }

    const parentId = findParentId(this.#nodes, node.id) ?? null;
    for (const child of node.children ?? []) {
      this.#modelManager.reparent(child.id, parentId);
    }

    return [node.id];
  }

  #dispatchGroupSelected(
    group: GroupManager | null
  ): void {
    document.dispatchEvent(new CustomEvent("groupSelected", {
      detail: { group }
    }));
  }

  readonly #onGroupCreated = (
    event: Event
  ): void => {
    const { group, name, parentId } = (event as CustomEvent).detail;
    this.#addGroupItemToUI(group, name || "Block", parentId ?? null);
  };

  readonly #onGroupRemoved = (
    event: Event
  ): void => {
    const { uuid } = (event as CustomEvent<GroupRemovedDetail>).detail;
    this.#nodes = removeTreeNode(this.#nodes, uuid);
    this.#host.requestUpdate();
  };

  readonly #onGroupReparented = (
    event: Event
  ): void => {
    const { uuid, parentUuid } = (event as CustomEvent<GroupReparentedDetail>).detail;
    const node = findNode(this.#nodes, uuid);
    if (node === null) {
      return;
    }

    this.#nodes = insertChildTreeNode(
      removeTreeNode(this.#nodes, uuid),
      parentUuid,
      node
    );

    if (parentUuid !== null && !this.#expanded.includes(parentUuid)) {
      this.#expanded = [...this.#expanded, parentUuid];
    }
    this.#host.requestUpdate();
  };

  readonly #onGroupRenamed = (
    event: Event
  ): void => {
    const { uuid, name } = (event as CustomEvent<GroupRenamedDetail>).detail;
    this.#nodes = relabelTreeNode(this.#nodes, uuid, name);
    this.#host.requestUpdate();
  };

  readonly #onGroupSelected = (
    event: Event
  ): void => {
    const { group } = (event as CustomEvent).detail;
    const uuid = group ? group.getGroupUUID() : null;
    this.#selected = uuid ? [uuid] : [];
    this.#host.requestUpdate();
  };

  readonly #onModelSnapshotApplied = (
    event: Event
  ): void => {
    const { nodes } = (event as CustomEvent<{ nodes: FlatModelNode[]; }>).detail;
    this.#nodes = buildTreeFromFlatNodes(nodes);
    this.#selected = [];
    this.#host.requestUpdate();
  };

  #addGroupItemToUI(
    group: GroupManager,
    label: string,
    parentId: string | null
  ): void {
    const node: TreeNode = { id: group.getGroupUUID(), label, renamable: true };
    this.#nodes = insertChildTreeNode(this.#nodes, parentId, node);

    if (parentId !== null && !this.#expanded.includes(parentId)) {
      this.#expanded = [...this.#expanded, parentId];
    }
    this.#host.requestUpdate();
  }
}
