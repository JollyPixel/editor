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
import {
  collectTreeNodeIds,
  insertAfterTreeNode,
  insertChildTreeNode,
  relabelTreeNode,
  removeTreeNode
} from "../treeNodes.ts";
import { promptNewBlock } from "./prompts/promptNewBlock.ts";
import { promptDuplicate } from "./prompts/promptDuplicate.ts";
import { promptDelete } from "./prompts/promptDelete.ts";

type Host = ReactiveControllerHost & HTMLElement;

export class BlockTreeController implements ReactiveController {
  #host: Host;
  #modelManager: ModelManager | null = null;
  #sceneManager: ModelSceneComponent | null = null;
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
    document.addEventListener("groupSelected", this.#onGroupSelected);
  }

  hostDisconnected(): void {
    document.removeEventListener("groupCreated", this.#onGroupCreated);
    document.removeEventListener("groupSelected", this.#onGroupSelected);
  }

  public get nodes(): TreeNode[] {
    return this.#nodes;
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
    this.#nodes = relabelTreeNode(this.#nodes, id, name);
    this.#host.requestUpdate();

    const group = this.#modelManager?.getGroupByUUID(id);
    if (group) {
      group.name = name;
    }
  };

  public readonly handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const { movedIds, targetId, where } = event.detail;
    const nextNodes = resolveReparent({ nodes: this.#nodes, movedIds, targetId, where });
    if (nextNodes === this.#nodes) {
      return;
    }

    this.#nodes = nextNodes;

    for (const movedId of movedIds) {
      this.#modelManager?.reparent(movedId, findParentId(nextNodes, movedId) ?? null);
    }

    if (where === "inside" && !this.#expanded.includes(targetId)) {
      this.#expanded = [...this.#expanded, targetId];
    }
    this.#host.requestUpdate();
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

    const duplicate = this.#duplicateSubtree(
      sourceNode,
      result.includeChildren,
      `${sourceNode.label} Copy`
    );
    if (duplicate === null) {
      return;
    }

    const parentId = findParentId(this.#nodes, sourceId) ?? null;
    this.#modelManager.reparentLocal(duplicate.uuid, parentId);
    this.#nodes = insertAfterTreeNode(this.#nodes, sourceId, duplicate.node);

    if (duplicate.node.children !== undefined) {
      this.#expanded = [...this.#expanded, duplicate.uuid];
    }
    this.#selected = [duplicate.uuid];
    this.#host.requestUpdate();

    const newGroup = this.#modelManager.getGroupByUUID(duplicate.uuid) ?? null;
    this.#modelManager.selectGroup(newGroup);
    this.#dispatchGroupSelected(newGroup);
  }

  #duplicateSubtree(
    node: TreeNode,
    includeChildren: boolean,
    label: string = node.label
  ): { node: TreeNode; uuid: string; } | null {
    if (!this.#modelManager) {
      return null;
    }

    const duplicateGroup = this.#modelManager.duplicateGroup(node.id, label);
    if (!duplicateGroup) {
      return null;
    }

    const uuid = duplicateGroup.getGroupUUID();
    const children: TreeNode[] = [];

    if (includeChildren && node.children !== undefined) {
      for (const child of node.children) {
        const duplicatedChild = this.#duplicateSubtree(child, true);
        if (duplicatedChild === null) {
          continue;
        }

        this.#modelManager.reparentLocal(duplicatedChild.uuid, uuid);
        children.push(duplicatedChild.node);
      }
    }

    return {
      node: {
        ...node,
        id: uuid,
        label,
        children: children.length > 0 ? children : undefined
      },
      uuid
    };
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
      this.#deleteSubtree(sourceNode) :
      this.#deleteNodePromotingChildren(sourceNode);

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

  #deleteSubtree(
    node: TreeNode
  ): string[] {
    this.#nodes = removeTreeNode(this.#nodes, node.id);

    return collectTreeNodeIds(node);
  }

  #deleteNodePromotingChildren(
    node: TreeNode
  ): string[] {
    if (!this.#modelManager) {
      return [];
    }

    const parentId = findParentId(this.#nodes, node.id) ?? null;

    let nextNodes = this.#nodes;
    let insertAfterId = node.id;
    for (const child of node.children ?? []) {
      nextNodes = insertAfterTreeNode(nextNodes, insertAfterId, child);
      insertAfterId = child.id;
      this.#modelManager.reparent(child.id, parentId);
    }

    this.#nodes = removeTreeNode(nextNodes, node.id);

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

  readonly #onGroupSelected = (
    event: Event
  ): void => {
    const { group } = (event as CustomEvent).detail;
    const uuid = group ? group.getGroupUUID() : null;
    this.#selected = uuid ? [uuid] : [];
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
