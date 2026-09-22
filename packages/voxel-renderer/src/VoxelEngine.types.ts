// Import Internal Dependencies
import type { VoxelCommandListener } from "./commands.ts";
import type { VoxelDocument } from "./document/VoxelDocument.ts";
import type {
  VoxelDocumentOptions,
  VoxelLoadOptions
} from "./document/VoxelDocument.types.ts";
import type { TilesetSource } from "./tileset/loadTilesets.ts";
import type { VoxelViewOptions } from "./view/VoxelView.types.ts";

export const VoxelRotation = {
  None: 0,
  CCW90: 1,
  Deg180: 2,
  CW90: 3
} as const;

export type {
  VoxelApplyOptions,
  VoxelLoadOptions
} from "./document/VoxelDocument.types.ts";
export type {
  MaterialCustomizerFn,
  ViewDistancePolicy
} from "./view/VoxelView.types.ts";

export type VoxelEngineEvents = {
  command: VoxelCommandListener;
};

export interface VoxelEngineLoadOptions
  extends Omit<VoxelLoadOptions, "tilesets"> {
  /**
   * Atlases to register before loading a world that uses them.
   */
  tilesets?: Iterable<TilesetSource>;
}

export interface VoxelEngineOptions
  extends Omit<VoxelDocumentOptions, "tilesets">, VoxelViewOptions {
  /**
   * Document to draw. A private one is built from the document options when
   * omitted; every other document option is then ignored.
   */
  document?: VoxelDocument;
}
