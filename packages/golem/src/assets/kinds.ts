// Import Third-party Dependencies
import { pixelArtEditableKind } from "@jolly-pixel/asset.pixel-art/server";
import { sceneEditableKind } from "@jolly-pixel/asset.scene/server";
import {
  SCRIPT_KIND,
  SHADER_KIND,
  TEXT_KIND,
  textEditableKind
} from "@jolly-pixel/asset.script";
import {
  blocksetEditableKind,
  voxelMapEditableKind
} from "@jolly-pixel/asset.voxel-map/server";
import { voxelModelEditableKind } from "@jolly-pixel/asset.voxel-model/server";
import type * as z from "zod/mini";

// Import Internal Dependencies
import type { AssetOpening } from "./GolemAsset.ts";
import { PixelArtAsset } from "./pixelArt/PixelArtAsset.ts";
import { SceneAsset } from "./scene/SceneAsset.ts";
import { TextAsset } from "./text/TextAsset.ts";
import { BlocksetAsset } from "./voxelMap/BlocksetAsset.ts";
import { VoxelMapAsset } from "./voxelMap/VoxelMapAsset.ts";
import { VoxelModelAsset } from "./voxelModel/VoxelModelAsset.ts";

// CONSTANTS
const kKinds: {
  [TKind in GolemKind]: GolemKindEntry<GolemAssets[TKind]>;
} = {
  scene: golemKind(sceneEditableKind(), SceneAsset),
  script: golemKind(textEditableKind(SCRIPT_KIND), TextAsset<typeof SCRIPT_KIND>),
  shader: golemKind(textEditableKind(SHADER_KIND), TextAsset<typeof SHADER_KIND>),
  text: golemKind(textEditableKind(TEXT_KIND), TextAsset<typeof TEXT_KIND>),
  voxelmap: golemKind(voxelMapEditableKind(), VoxelMapAsset),
  blockset: golemKind(blocksetEditableKind(), BlocksetAsset),
  voxelmodel: golemKind(voxelModelEditableKind(), VoxelModelAsset),
  pixelart: golemKind(pixelArtEditableKind(), PixelArtAsset)
};
export const GOLEM_KINDS: readonly GolemKind[] = Object.freeze(
  Object.keys(kKinds) as GolemKind[]
);

interface GolemKindEntry<TAsset> {
  readonly schema: z.ZodMiniType;
  open(opening: AssetOpening): TAsset;
}

export interface GolemAssets {
  scene: SceneAsset;
  script: TextAsset<typeof SCRIPT_KIND>;
  shader: TextAsset<typeof SHADER_KIND>;
  text: TextAsset<typeof TEXT_KIND>;
  voxelmap: VoxelMapAsset;
  blockset: BlocksetAsset;
  voxelmodel: VoxelModelAsset;
  pixelart: PixelArtAsset;
}

export type GolemKind = keyof GolemAssets;

export function isGolemKind(
  kind: string
): kind is GolemKind {
  return Object.hasOwn(kKinds, kind);
}

export function golemCommandSchema(
  kind: GolemKind
): z.ZodMiniType {
  return kKinds[kind].schema;
}

export function openAsset<TKind extends GolemKind>(
  kind: TKind,
  opening: AssetOpening
): GolemAssets[TKind] {
  return kKinds[kind].open(opening);
}

function golemKind<
  TDocumentKind extends { readonly commandSchema: z.ZodMiniType; },
  TAsset
>(
  documentKind: TDocumentKind,
  Asset: new (opening: AssetOpening, kind: TDocumentKind) => TAsset
): GolemKindEntry<TAsset> {
  return {
    schema: documentKind.commandSchema,
    open: (opening) => new Asset(opening, documentKind)
  };
}
