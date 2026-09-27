// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { ModelTree, type ModelTreeReader } from "./ModelTree.ts";
import { createBlockTransform } from "./blockTransform.ts";
import { createBlockUv } from "./blockUv.ts";
import { createMaterialSurface } from "./materialSurface.ts";
import type {
  BlockTransformJSON,
  MaterialEntryJSON,
  MaterialSurfaceJSON,
  MaterialSurfacePatchJSON,
  MirrorAxes,
  ModelNodeJSON,
  NodeTransformJSON,
  UVLayoutData,
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../network/types.ts";

export type ModelOrigin = "local" | "remote";

export interface ModelChange {
  command: VoxelModelCommand;
  origin: ModelOrigin;
  removed: readonly ModelNodeJSON[];
  previous: readonly ModelNodeJSON[];
  previousMaterials: readonly MaterialEntryJSON[];
}

export type ModelDocumentEvents = {
  change: (change: ModelChange) => void;
  reset: () => void;
};

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

export class ModelDocument extends Emitter<ModelDocumentEvents> {
  #tree = new ModelTree();

  readonly tree: ModelTreeReader = this.#tree;

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
    const added = this.#commit({
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
    const added = this.#commit({
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
    return this.#commit({
      action: "node-removed",
      id
    });
  }

  rename(
    id: string,
    name: string
  ): boolean {
    return this.#commit({
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

    return this.#commit({
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
    return this.#commit({
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
    return this.#commit({
      action: "node-uv-changed",
      id,
      uv
    });
  }

  assignMaterial(
    id: string,
    materialId: string | null
  ): boolean {
    return this.#commit({
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
    const added = this.#commit({
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
    const added = this.#commit({
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
    return this.#commit({
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
    return this.#commit({
      action: "material-removed",
      id,
      ...(options.keepContents === true ? { keepContents: true } : {})
    });
  }

  renameMaterial(
    id: string,
    name: string
  ): boolean {
    return this.#commit({
      action: "material-renamed",
      id,
      name
    });
  }

  changeMaterial(
    id: string,
    surface: MaterialSurfacePatchJSON
  ): boolean {
    return this.#commit({
      action: "material-changed",
      id,
      surface
    });
  }

  apply(
    command: VoxelModelCommand
  ): boolean {
    if (!this.#tree.accepts(command)) {
      return false;
    }
    this.#apply(command, "remote");

    return true;
  }

  load(
    snapshot: VoxelModelSnapshot
  ): void {
    this.#tree.load(snapshot);
    this.emit("reset");
  }

  #commit(
    command: VoxelModelCommand
  ): boolean {
    if (!this.#tree.accepts(command)) {
      return false;
    }
    this.#apply(command, "local");

    return true;
  }

  #apply(
    command: VoxelModelCommand,
    origin: ModelOrigin
  ): void {
    const previous = this.#tree.imagesOf(command);
    const previousMaterials = this.#tree.materialImagesOf(command);
    this.#tree.apply(command);
    this.emit("change", {
      command,
      origin,
      removed: command.action === "node-removed" ? previous : [],
      previous,
      previousMaterials
    });
  }
}
