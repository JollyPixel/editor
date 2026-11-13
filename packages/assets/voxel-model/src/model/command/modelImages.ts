// Import Internal Dependencies
import type { ModelCollections } from "./ModelCollections.ts";
import type {
  AnimationSetLinkJSON,
  MaterialEntryJSON,
  ModelNodeJSON,
  VoxelModelSnapshot
} from "../types.ts";

export interface ModelImages {
  nodes: readonly ModelNodeJSON[];
  materials: readonly MaterialEntryJSON[];
  animationSets: readonly AnimationSetLinkJSON[];
}

export type ModelEntryField = keyof ModelImages;

export type EntryOrder = Record<ModelEntryField, readonly string[]>;

export interface ModelImage {
  readonly before: ModelImages;
  readonly order: EntryOrder;
}

export function entryOrder(
  tree: ModelCollections
): EntryOrder {
  return {
    nodes: collectIds(tree.nodes.values()),
    materials: collectIds(tree.materials.values()),
    animationSets: collectIds(tree.animationSets.values())
  };
}

export function restoreModelImages(
  tree: ModelCollections,
  images: readonly ModelImage[]
): VoxelModelSnapshot {
  return {
    nodes: restored(tree.nodes.values(), images, "nodes"),
    materials: restored(tree.materials.values(), images, "materials"),
    animationSets: restored(tree.animationSets.values(), images, "animationSets")
  };
}

function restored<TField extends ModelEntryField>(
  current: Iterable<ModelImages[TField][number]>,
  images: readonly ModelImage[],
  field: TField
): ModelImages[TField][number][] {
  const entries = new Map([...current].map((entry) => [entry.id, entry]));
  for (const { before } of [...images].reverse()) {
    for (const entry of before[field]) {
      entries.set(entry.id, entry);
    }
  }
  const order = images.at(0)?.order[field] ?? [...entries.keys()];

  return order.flatMap((id) => entries.get(id) ?? []);
}

function collectIds(
  entries: Iterable<{ id: string; }>
): string[] {
  return Array.from(entries, ({ id }) => id);
}
