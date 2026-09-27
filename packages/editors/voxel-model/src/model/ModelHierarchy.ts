// Import Third-party Dependencies
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";
import {
  createBlockTransform,
  createBlockUv,
  nextBlockUvOrigin,
  type AddFolderOptions,
  type BlockTransformJSON,
  type MirrorAxes,
  type ModelDocument,
  type ModelNodeJSON,
  type NodeTransformJSON
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  buildHierarchyNodes,
  type HierarchyNode
} from "./hierarchyNodes.ts";

export interface BlockPoses {
  under(
    uuid: string,
    parentUuid: string | null
  ): BlockTransformJSON;
  mirror(
    uuids: Iterable<string>,
    axes: MirrorAxes
  ): NodeTransformJSON[];
}

export interface ModelHierarchyOptions {
  document: ModelDocument;
  textureSize(): Vec2;
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
  #textureSize: () => Vec2;
  #poses: BlockPoses;

  constructor(
    options: ModelHierarchyOptions
  ) {
    this.#document = options.document;
    this.#textureSize = options.textureSize;
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
    const layouts = [...this.#document.tree.blocks()].map((block) => block.uv);

    return this.#document.addBlock({
      name,
      parentId,
      transform: createBlockTransform(),
      uv: createBlockUv(nextBlockUvOrigin(layouts, this.#textureSize()))
    });
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
    parentId: string | null,
    beforeId?: string
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

    this.#document.move(id, parentId, {
      transforms,
      beforeId
    });
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
      {
        name: `${source.name} Copy`,
        parentId: source.parentId,
        beforeId: this.#document.tree.nextSiblingOf(source.id)
      },
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
        this.move(child.id, node.parentId, id);
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
    copy: AddFolderOptions,
    includeChildren: boolean,
    duplicatedUuids: string[]
  ): string | null {
    const children = includeChildren ?
      this.#document.tree.childrenOf(node.id) :
      [];
    const duplicateId = node.kind === "folder" ?
      this.#document.addFolder(copy) :
      this.#document.addBlock({
        ...copy,
        transform: node.transform,
        uv: node.uv,
        materialId: node.materialId
      });
    if (duplicateId === null) {
      return null;
    }

    if (node.kind === "block") {
      duplicatedUuids.push(duplicateId);
    }
    for (const child of children) {
      this.#duplicateNode(
        child,
        {
          name: child.name,
          parentId: duplicateId
        },
        true,
        duplicatedUuids
      );
    }

    return duplicateId;
  }
}
