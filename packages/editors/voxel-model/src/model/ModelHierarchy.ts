// Import Third-party Dependencies
import type { MirrorAxes } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type { ModelBlock } from "./ModelBlock.ts";
import type { ModelDocument } from "./ModelDocument.ts";
import {
  buildHierarchyNodes,
  collectHierarchyIds,
  findHierarchyNode,
  findHierarchyParentId,
  type HierarchyNode
} from "./hierarchyNodes.ts";
import { anyMirrorAxis } from "./mirrorTransform.ts";

export interface BlockRegions {
  create(
    uuid: string,
    name: string
  ): void;
  copy(
    sourceUuid: string,
    uuid: string,
    name: string
  ): void;
}

export interface ModelHierarchyOptions {
  document: ModelDocument;
  regions: BlockRegions;
}

export interface DuplicateOptions {
  includeChildren: boolean;
  mirrorAxes: MirrorAxes;
}

export interface RemoveOptions {
  withChildren: boolean;
}

export class ModelHierarchy {
  #document: ModelDocument;
  #regions: BlockRegions;

  constructor(
    options: ModelHierarchyOptions
  ) {
    this.#document = options.document;
    this.#regions = options.regions;
  }

  nodes(): HierarchyNode[] {
    return buildHierarchyNodes(
      this.#document.blocks,
      this.#document.folders
    );
  }

  isFolder(
    id: string
  ): boolean {
    return this.#document.folders.has(id);
  }

  createBlock(
    name: string,
    parentId: string | null
  ): ModelBlock {
    const { blocks, folders } = this.#document;
    const block = blocks.add({ name });

    if (parentId !== null) {
      const blockParentId = folders.nearestBlockAncestor(parentId);
      if (blockParentId === null) {
        blocks.reparent(block.uuid, null);
      }
      else {
        blocks.reparentAtParentPosition(block.uuid, blockParentId);
      }

      if (folders.has(parentId)) {
        folders.place(block.uuid, parentId);
      }
    }

    this.#regions.create(block.uuid, name);
    blocks.select(block);

    return block;
  }

  createFolder(
    name: string,
    parentId: string | null
  ): string {
    return this.#document.folders.add({ name, parentId });
  }

  rename(
    id: string,
    name: string
  ): void {
    if (this.isFolder(id)) {
      this.#document.folders.rename(id, name);
    }
    else {
      this.#document.blocks.rename(id, name);
    }
  }

  move(
    id: string,
    parentId: string | null
  ): void {
    const { blocks, folders } = this.#document;

    if (this.isFolder(id)) {
      folders.reparent(id, parentId);
      this.#reparentPlacedBlocksUnder(id);

      return;
    }

    const parentIsFolder = parentId !== null && this.isFolder(parentId);
    blocks.reparent(id, folders.nearestBlockAncestor(parentId) ?? parentId);
    folders.place(id, parentIsFolder ? parentId : null);
  }

  duplicate(
    sourceId: string,
    options: DuplicateOptions
  ): string | null {
    const nodes = this.nodes();
    const source = findHierarchyNode(nodes, sourceId);
    if (source === null) {
      return null;
    }

    const duplicatedBlockIds: string[] = [];
    const duplicateId = this.#duplicateNode(
      source,
      findHierarchyParentId(nodes, sourceId) ?? null,
      `${source.name} Copy`,
      options.includeChildren,
      duplicatedBlockIds
    );

    if (duplicateId !== null && anyMirrorAxis(options.mirrorAxes)) {
      this.#document.blocks.mirror(duplicatedBlockIds, options.mirrorAxes);
    }

    return duplicateId;
  }

  remove(
    id: string,
    options: RemoveOptions
  ): void {
    const nodes = this.nodes();
    const node = findHierarchyNode(nodes, id);
    if (node === null) {
      return;
    }

    if (options.withChildren) {
      this.#removeSubtree(node);
    }
    else {
      this.#promoteChildrenThenRemove(node, findHierarchyParentId(nodes, id) ?? null);
    }
  }

  #duplicateNode(
    node: HierarchyNode,
    parentId: string | null,
    name: string,
    includeChildren: boolean,
    duplicatedBlockIds: string[]
  ): string | null {
    const duplicateId = node.kind === "folder" ?
      this.createFolder(name, parentId) :
      this.#duplicateBlock(node.id, name, parentId);
    if (duplicateId === null) {
      return null;
    }

    if (node.kind === "block") {
      duplicatedBlockIds.push(duplicateId);
    }

    if (includeChildren) {
      for (const child of node.children) {
        this.#duplicateNode(child, duplicateId, child.name, true, duplicatedBlockIds);
      }
    }

    return duplicateId;
  }

  #duplicateBlock(
    sourceId: string,
    name: string,
    parentId: string | null
  ): string | null {
    const { blocks, folders } = this.#document;
    const duplicate = blocks.duplicate(sourceId, name);
    if (duplicate === null) {
      return null;
    }

    this.#regions.copy(sourceId, duplicate.uuid, name);

    const parentIsFolder = parentId !== null && this.isFolder(parentId);
    blocks.reparentLocal(duplicate.uuid, folders.nearestBlockAncestor(parentId) ?? parentId);
    if (parentIsFolder) {
      folders.place(duplicate.uuid, parentId);
    }

    return duplicate.uuid;
  }

  #removeSubtree(
    node: HierarchyNode
  ): void {
    const ids = collectHierarchyIds(node);

    for (const id of ids.filter((id) => !this.isFolder(id))) {
      this.#removeBlock(id);
    }
    for (const id of ids.filter((id) => this.isFolder(id))) {
      this.#document.folders.remove(id);
    }
  }

  #promoteChildrenThenRemove(
    node: HierarchyNode,
    parentId: string | null
  ): void {
    const { blocks, folders } = this.#document;

    for (const child of node.children) {
      this.move(child.id, parentId);
    }

    if (node.kind === "folder") {
      folders.remove(node.id);

      return;
    }

    for (const descendantId of collectHierarchyIds(node)) {
      if (
        descendantId !== node.id &&
        !this.isFolder(descendantId) &&
        blocks.parentOf(descendantId) === node.id
      ) {
        blocks.reparent(descendantId, parentId);
      }
    }

    this.#removeBlock(node.id);
  }

  #removeBlock(
    uuid: string
  ): void {
    this.#document.folders.place(uuid, null);
    this.#document.blocks.remove(uuid);
  }

  #reparentPlacedBlocksUnder(
    folderId: string
  ): void {
    const { blocks, folders } = this.#document;
    const subtreeIds = folders.subtreeOf(folderId);

    for (const [blockUuid, placedFolderId] of [...folders.placements]) {
      if (subtreeIds.has(placedFolderId)) {
        blocks.reparent(blockUuid, folders.nearestBlockAncestor(placedFolderId));
      }
    }
  }
}
