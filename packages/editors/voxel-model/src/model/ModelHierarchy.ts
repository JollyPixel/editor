// Import Third-party Dependencies
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";
import {
  BlockTransform,
  BlockUvLayouts,
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
import { blockNameTakenMessage } from "./nodeNames.ts";

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

export interface BuildRecorder {
  record<T>(label: string | null, edit: () => T): T;
}

export interface ModelHierarchyOptions {
  document: ModelDocument;
  edits: BuildRecorder;
  textureSize(): Vec2;
  poses: BlockPoses;
}

export interface DuplicateOptions {
  name: string;
  includeChildren: boolean;
  mirrorAxes: MirrorAxes;
}

export interface NodeMove {
  id: string;
  parentId: string | null;
  beforeId?: string;
}

export interface RemoveOptions {
  withChildren: boolean;
}

export class ModelHierarchy {
  #document: ModelDocument;
  #edits: BuildRecorder;
  #textureSize: () => Vec2;
  #poses: BlockPoses;

  constructor(
    options: ModelHierarchyOptions
  ) {
    this.#document = options.document;
    this.#edits = options.edits;
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

  blockNameError(
    name: string,
    parentId: string | null,
    exceptId?: string
  ): string | null {
    const { tree } = this.#document;

    return tree.blockNamesUnder(parentId, exceptId).has(name) ?
      blockNameTakenMessage(tree, parentId, name.trim()) :
      null;
  }

  renameError(
    id: string,
    name: string
  ): string | null {
    const node = this.#document.tree.get(id);

    return node?.kind === "block" ?
      this.blockNameError(name, node.parentId, id) :
      null;
  }

  createBlock(
    name: string,
    parentId: string | null
  ): string | null {
    const layouts = new BlockUvLayouts([...this.#document.tree.blocks()].map((block) => block.uv));

    return this.#document.addBlock({
      name,
      parentId,
      transform: BlockTransform.create(),
      uv: layouts.nextNet(this.#textureSize())
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
    this.#edits.record(null, () => this.#document.rename(id, name));
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

    this.#edits.record(null, () => this.#document.move(id, parentId, {
      transforms,
      beforeId
    }));
  }

  moveAll(
    moves: readonly NodeMove[]
  ): void {
    const label = moves.length > 1 ? `Move ${moves.length} nodes` : null;
    this.#edits.record(label, () => {
      for (const { id, parentId, beforeId } of moves) {
        this.move(id, parentId, beforeId);
      }
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

    return this.#edits.record(`Duplicate ${source.name}`, () => {
      const { mirrorAxes } = options;
      const duplicatedUuids: string[] = [];
      const duplicateId = this.#duplicateNode(
        source,
        {
          name: options.name,
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
    });
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

    this.#edits.record(`Delete ${node.name}`, () => {
      if (!options.withChildren) {
        for (const child of tree.childrenOf(id)) {
          this.move(child.id, node.parentId, id);
        }
      }
      this.#document.remove(id);
    });
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
        name: this.#document.tree.blockNamesUnder(copy.parentId ?? null).free(copy.name),
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
