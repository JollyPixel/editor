// Import Third-party Dependencies
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";
import {
  BlockShape,
  BlockTransform,
  BlockUvLayouts,
  type AddFolderOptions,
  type BlockShapeJSON,
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
import type { ModelAccessSource } from "../access/ModelAccess.ts";

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
  access: ModelAccessSource;
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
  #access: ModelAccessSource;

  constructor(
    options: ModelHierarchyOptions
  ) {
    this.#document = options.document;
    this.#edits = options.edits;
    this.#textureSize = options.textureSize;
    this.#poses = options.poses;
    this.#access = options.access;
  }

  get editable(): boolean {
    return this.#access.current.has("hierarchy");
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
    parentId: string | null,
    shape: BlockShapeJSON = BlockShape.box
  ): string | null {
    if (!this.editable) {
      return null;
    }
    const layouts = new BlockUvLayouts([...this.#document.tree.blocks()].map((block) => block.uv));

    return this.#document.addBlock({
      name,
      parentId,
      transform: BlockTransform.create(),
      shape,
      uv: layouts.nextNet(this.#textureSize(), shape)
    });
  }

  reshape(
    id: string,
    shape: BlockShapeJSON
  ): boolean {
    const { tree } = this.#document;
    const block = tree.block(id);
    if (
      !this.#access.current.has("transforms") ||
      block === undefined ||
      BlockShape.same(BlockShape.fromBlock(block), shape)
    ) {
      return false;
    }

    const others = new BlockUvLayouts(
      [...tree.blocks()].filter((each) => each.id !== id).map((each) => each.uv)
    );

    return this.#document.updateShape(
      id,
      shape,
      others.reshaped(block.uv, BlockShape.fromBlock(block), shape, this.#textureSize())
    );
  }

  createFolder(
    name: string,
    parentId: string | null
  ): string | null {
    if (!this.editable) {
      return null;
    }

    return this.#document.addFolder({
      name,
      parentId
    });
  }

  rename(
    id: string,
    name: string
  ): void {
    if (this.editable) {
      this.#edits.record(null, () => this.#document.rename(id, name));
    }
  }

  move(
    id: string,
    parentId: string | null,
    beforeId?: string
  ): void {
    if (!this.editable) {
      return;
    }
    const { tree } = this.#document;
    const parentUuid = tree.findEnclosingBlock(parentId);
    const transforms = this.#blocksCarriedBy(id)
      .filter((uuid) => tree.findTransformParent(uuid) !== parentUuid)
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
    const { mirrorAxes } = options;
    if (
      source === undefined ||
      !this.editable ||
      (isMirrored(mirrorAxes) && !this.#access.current.has("transforms"))
    ) {
      return null;
    }

    return this.#edits.record(`Duplicate ${source.name}`, () => {
      const duplicatedUuids: string[] = [];
      const duplicateId = this.#duplicateNode(
        source,
        {
          name: options.name,
          parentId: source.parentId,
          beforeId: this.#document.tree.findNextSibling(source.id)
        },
        options.includeChildren,
        duplicatedUuids
      );

      if (
        duplicateId !== null &&
        isMirrored(mirrorAxes)
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
    if (node === undefined || !this.editable) {
      return;
    }

    this.#edits.record(`Delete ${node.name}`, () => {
      if (!options.withChildren) {
        for (const child of tree.listChildren(id)) {
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

    return tree.listChildren(id).flatMap(
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
      this.#document.tree.listChildren(node.id) :
      [];
    const duplicateId = node.kind === "folder" ?
      this.#document.addFolder(copy) :
      this.#document.addBlock({
        ...copy,
        name: this.#document.tree.blockNamesUnder(copy.parentId ?? null).free(copy.name),
        transform: node.transform,
        shape: BlockShape.fromBlock(node),
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

function isMirrored(
  axes: MirrorAxes
): boolean {
  return axes.x || axes.y || axes.z;
}
