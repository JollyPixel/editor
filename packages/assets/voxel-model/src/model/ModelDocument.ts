// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { ModelTree, type ModelTreeReader } from "./ModelTree.ts";
import { createBlockTransform } from "./blockTransform.ts";
import { createBlockUv } from "./blockUv.ts";
import { createMaterialSurface } from "./materialSurface.ts";
import { inverseOf } from "./modelInverse.ts";
import {
  modelImageOf,
  restoreModelImages,
  type EntryOrder,
  type ModelImage,
  type ModelImages
} from "./modelImages.ts";
import type {
  BlockTransformJSON,
  MaterialSurfaceJSON,
  MaterialSurfacePatchJSON,
  MirrorAxes,
  NodeTransformJSON,
  UVLayoutData,
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../network/types.ts";

export type { EntryOrder, ModelImage, ModelImages };

export type ModelChange = CommandChange<VoxelModelCommand, ModelImage>;

export interface AddFolderOptions {
  id?: string;
  name: string;
  parentId?: string | null;
  /** The sibling to land before; last when omitted. */
  beforeId?: string;
}

export interface AddBlockOptions extends AddFolderOptions {
  transform?: BlockTransformJSON;
  uv?: UVLayoutData;
  materialId?: string;
}

export interface AddMaterialFolderOptions {
  id?: string;
  name: string;
  parentId?: string | null;
  /** The sibling to land before; last when omitted. */
  beforeId?: string;
}

export interface AddMaterialOptions extends AddMaterialFolderOptions {
  surface?: MaterialSurfaceJSON;
}

export interface RemoveMaterialOptions {
  /** Removes only the folder and lifts its entries into its place. */
  keepContents?: boolean;
}

export interface MoveOptions {
  transforms?: Iterable<NodeTransformJSON>;
  /** The sibling to land before; last when omitted. */
  beforeId?: string;
}

export class ModelDocument extends CommandDocument<
  VoxelModelCommand,
  VoxelModelSnapshot,
  ModelImage
> {
  readonly tree: ModelTreeReader;

  constructor() {
    const tree = new ModelTree();
    super(modelState(tree));
    this.tree = tree;
  }

  addBlock(
    options: AddBlockOptions
  ): string | null {
    const {
      id = crypto.randomUUID(),
      name,
      parentId = null,
      transform = createBlockTransform(),
      uv = createBlockUv(),
      materialId,
      beforeId
    } = options;
    const added = this.commit({
      action: "node-added",
      node: {
        kind: "block",
        id,
        parentId,
        name,
        transform,
        uv,
        ...(materialId === undefined ? {} : { materialId })
      },
      ...(beforeId === undefined ? {} : { beforeId })
    });

    return added ? id : null;
  }

  addFolder(
    options: AddFolderOptions
  ): string | null {
    const {
      id = crypto.randomUUID(),
      name,
      parentId = null,
      beforeId
    } = options;
    const added = this.commit({
      action: "node-added",
      node: {
        kind: "folder",
        id,
        parentId,
        name
      },
      ...(beforeId === undefined ? {} : { beforeId })
    });

    return added ? id : null;
  }

  remove(
    id: string
  ): boolean {
    return this.commit({
      action: "node-removed",
      id
    });
  }

  rename(
    id: string,
    name: string
  ): boolean {
    return this.commit({
      action: "node-renamed",
      id,
      name
    });
  }

  move(
    id: string,
    parentId: string | null,
    options: MoveOptions = {}
  ): boolean {
    const {
      transforms = [],
      beforeId
    } = options;

    return this.commit({
      action: "node-moved",
      id,
      parentId,
      transforms: [...transforms],
      ...(beforeId === undefined ? {} : { beforeId })
    });
  }

  transform(
    id: string,
    transform: BlockTransformJSON,
    flipAxes?: MirrorAxes
  ): boolean {
    return this.commit({
      action: "node-transformed",
      id,
      transform,
      ...(flipAxes ? { flipAxes } : {})
    });
  }

  setUv(
    id: string,
    uv: UVLayoutData
  ): boolean {
    return this.commit({
      action: "node-uv-changed",
      id,
      uv
    });
  }

  assignMaterial(
    id: string,
    materialId: string | null
  ): boolean {
    return this.commit({
      action: "node-material-changed",
      id,
      materialId
    });
  }

  addMaterial(
    options: AddMaterialOptions
  ): string | null {
    const {
      id = crypto.randomUUID(),
      name,
      parentId = null,
      beforeId,
      surface = createMaterialSurface()
    } = options;
    const added = this.commit({
      action: "material-added",
      material: {
        kind: "material",
        id,
        parentId,
        name,
        surface
      },
      ...(beforeId === undefined ? {} : { beforeId })
    });

    return added ? id : null;
  }

  addMaterialFolder(
    options: AddMaterialFolderOptions
  ): string | null {
    const {
      id = crypto.randomUUID(),
      name,
      parentId = null,
      beforeId
    } = options;
    const added = this.commit({
      action: "material-folder-added",
      folder: {
        kind: "folder",
        id,
        parentId,
        name
      },
      ...(beforeId === undefined ? {} : { beforeId })
    });

    return added ? id : null;
  }

  moveMaterial(
    id: string,
    parentId: string | null,
    beforeId?: string
  ): boolean {
    return this.commit({
      action: "material-moved",
      id,
      parentId,
      ...(beforeId === undefined ? {} : { beforeId })
    });
  }

  removeMaterial(
    id: string,
    options: RemoveMaterialOptions = {}
  ): boolean {
    return this.commit({
      action: "material-removed",
      id,
      ...(options.keepContents === true ? { keepContents: true } : {})
    });
  }

  renameMaterial(
    id: string,
    name: string
  ): boolean {
    return this.commit({
      action: "material-renamed",
      id,
      name
    });
  }

  changeMaterial(
    id: string,
    surface: MaterialSurfacePatchJSON
  ): boolean {
    return this.commit({
      action: "material-changed",
      id,
      surface
    });
  }

  linkAnimationSet(
    reference: AssetReferenceData,
    options: { own?: boolean; } = {}
  ): boolean {
    return this.commit({
      action: "animation-set-linked",
      link: {
        id: reference.id,
        kind: reference.kind,
        bindings: [],
        ...options.own ? { own: true } : {}
      }
    });
  }

  shareAnimationSet(
    id: string
  ): boolean {
    return this.commit({
      action: "animation-set-owned",
      id,
      own: false
    });
  }

  unlinkAnimationSet(
    id: string
  ): boolean {
    return this.commit({
      action: "animation-set-unlinked",
      id
    });
  }

  remapAnimationTrack(
    id: string,
    path: string,
    target: string | null
  ): boolean {
    return this.commit({
      action: "animation-binding-changed",
      id,
      path,
      target
    });
  }

  clearAnimationTrackRemap(
    id: string,
    path: string
  ): boolean {
    return this.commit({
      action: "animation-binding-cleared",
      id,
      path
    });
  }
}

function modelState(
  tree: ModelTree
): CommandState<VoxelModelCommand, VoxelModelSnapshot, ModelImage> {
  return {
    accepts: (command) => tree.accepts(command),
    placeable: (command) => tree.placeable(command),
    apply: (command) => tree.apply(command),
    load: (snapshot) => tree.load(snapshot),
    imageOf: (command) => modelImageOf(tree, command),
    inverseOf: (command) => inverseOf(tree, command),
    restored: (images) => restoreModelImages(tree, images)
  };
}
