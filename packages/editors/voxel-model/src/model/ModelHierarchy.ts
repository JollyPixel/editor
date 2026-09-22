// Import Third-party Dependencies
import {
  createBlockTransform,
  type BlockTransformJSON,
  type MirrorAxes,
  type ModelDocument,
  type ModelNodeJSON,
  type NodeTransformJSON,
  type Vector3JSON
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  buildHierarchyNodes,
  type HierarchyNode
} from "./hierarchyNodes.ts";

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

export interface BlockPoses {
  under(
    uuid: string,
    parentUuid: string | null
  ): BlockTransformJSON;
  originUnder(
    parentUuid: string
  ): Vector3JSON;
  mirror(
    uuids: Iterable<string>,
    axes: MirrorAxes
  ): NodeTransformJSON[];
}

export interface ModelHierarchyOptions {
  document: ModelDocument;
  regions: BlockRegions;
  poses: BlockPoses;
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
  #poses: BlockPoses;

  constructor(
    options: ModelHierarchyOptions
  ) {
    this.#document = options.document;
    this.#regions = options.regions;
    this.#poses = options.poses;
  }

  nodes(): HierarchyNode[] {
    return buildHierarchyNodes(this.#document.tree);
  }

  isFolder(
    id: string
  ): boolean {
    return this.#document.tree.get(id)?.kind === "folder";
  }

  createBlock(
    name: string,
    parentId: string | null
  ): string | null {
    const parentUuid = this.#document.tree.enclosingBlockOf(parentId);
    const id = this.#document.addBlock({
      name,
      parentId,
      transform: parentUuid === null ?
        createBlockTransform() :
        createBlockTransform({
          position: this.#poses.originUnder(parentUuid)
        })
    });
    if (id !== null) {
      this.#regions.create(id, name);
    }

    return id;
  }

  createFolder(
    name: string,
    parentId: string | null
  ): string | null {
    return this.#document.addFolder({
      name,
      parentId
    });
  }

  rename(
    id: string,
    name: string
  ): void {
    this.#document.rename(id, name);
  }

  move(
    id: string,
    parentId: string | null
  ): void {
    const { tree } = this.#document;
    const parentUuid = tree.enclosingBlockOf(parentId);
    const transforms = this.#blocksCarriedBy(id)
      .filter((uuid) => tree.transformParentOf(uuid) !== parentUuid)
      .map((uuid) => {
        return {
          id: uuid,
          transform: this.#poses.under(uuid, parentUuid)
        };
      });

    this.#document.move(id, parentId, transforms);
  }

  duplicate(
    sourceId: string,
    options: DuplicateOptions
  ): string | null {
    const source = this.#document.tree.get(sourceId);
    if (source === undefined) {
      return null;
    }

    const { mirrorAxes } = options;
    const duplicatedUuids: string[] = [];
    const duplicateId = this.#duplicateNode(
      source,
      source.parentId,
      `${source.name} Copy`,
      options.includeChildren,
      duplicatedUuids
    );

    if (
      duplicateId !== null &&
      (mirrorAxes.x || mirrorAxes.y || mirrorAxes.z)
    ) {
      const mirrored = this.#poses.mirror(
        duplicatedUuids,
        mirrorAxes
      );
      for (const { id, transform } of mirrored) {
        this.#document.transform(id, transform, mirrorAxes);
      }
    }

    return duplicateId;
  }

  remove(
    id: string,
    options: RemoveOptions
  ): void {
    const { tree } = this.#document;
    const node = tree.get(id);
    if (node === undefined) {
      return;
    }

    if (!options.withChildren) {
      for (const child of tree.childrenOf(id)) {
        this.move(child.id, node.parentId);
      }
    }
    this.#document.remove(id);
  }

  #blocksCarriedBy(
    id: string
  ): string[] {
    const { tree } = this.#document;
    const node = tree.get(id);
    if (node === undefined) {
      return [];
    }
    if (node.kind === "block") {
      return [node.id];
    }

    return tree.childrenOf(id).flatMap(
      (child) => this.#blocksCarriedBy(child.id)
    );
  }

  #duplicateNode(
    node: ModelNodeJSON,
    parentId: string | null,
    name: string,
    includeChildren: boolean,
    duplicatedUuids: string[]
  ): string | null {
    const children = includeChildren ?
      this.#document.tree.childrenOf(node.id) :
      [];
    const duplicateId = node.kind === "folder" ?
      this.createFolder(name, parentId) :
      this.#duplicateBlock(node.id, name, parentId);
    if (duplicateId === null) {
      return null;
    }

    if (node.kind === "block") {
      duplicatedUuids.push(duplicateId);
    }
    for (const child of children) {
      this.#duplicateNode(
        child,
        duplicateId,
        child.name,
        true,
        duplicatedUuids
      );
    }

    return duplicateId;
  }

  #duplicateBlock(
    sourceUuid: string,
    name: string,
    parentId: string | null
  ): string | null {
    const source = this.#document.tree.block(sourceUuid);
    if (source === undefined) {
      return null;
    }

    const uuid = this.#document.addBlock({
      name,
      parentId,
      transform: source.transform
    });
    if (uuid !== null) {
      this.#regions.copy(sourceUuid, uuid, name);
    }

    return uuid;
  }
}
