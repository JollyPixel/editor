// Import Third-party Dependencies
import { TrackPath } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import { MaterialSurface } from "../materials/MaterialSurface.ts";
import type { ModelCollections } from "./ModelCollections.ts";

// CONSTANTS
const kNodeValueKinds = [
  "name",
  "parent",
  "transform",
  "flip",
  "uv",
  "shape",
  "material"
] as const;

export type NodeValueKind = typeof kNodeValueKinds[number];

export type ModelValueRef =
  | { kind: NodeValueKind; id: string; }
  | { kind: "material-name" | "material-parent"; id: string; }
  | { kind: "material-surface"; id: string; field: string; }
  | { kind: "animation-own"; id: string; }
  | { kind: "animation-binding"; id: string; path: string; };

export function modelValueKey(
  ref: ModelValueRef
): string {
  switch (ref.kind) {
    case "material-surface":
      return `${ref.kind}:${ref.id}:${ref.field}`;
    case "animation-binding":
      return `${ref.kind}:${ref.id}:${new TrackPath(ref.path).key}`;
    default:
      return `${ref.kind}:${ref.id}`;
  }
}

export function readModelValue(
  tree: ModelCollections,
  ref: ModelValueRef
): unknown {
  switch (ref.kind) {
    case "name":
      return tree.nodes.get(ref.id)?.name;
    case "parent":
      return tree.nodes.get(ref.id)?.parentId;
    case "transform":
      return tree.nodes.block(ref.id)?.transform;
    case "flip":
      return tree.nodes.block(ref.id)?.flipAxes;
    case "uv":
      return tree.nodes.block(ref.id)?.uv;
    case "shape":
      return tree.nodes.block(ref.id)?.shape;
    case "material":
      return tree.nodes.blockMaterialId(ref.id);
    case "material-name":
      return tree.materials.get(ref.id)?.name;
    case "material-parent":
      return tree.materials.get(ref.id)?.parentId;
    case "material-surface":
      return Reflect.get(tree.materials.material(ref.id)?.surface ?? {}, ref.field);
    case "animation-own":
      return tree.animationSets.get(ref.id)?.own === true;
    case "animation-binding":
      return tree.animationSets.binding(ref.id, ref.path);
  }
}

export function nodeValueRefs(
  id: string
): ModelValueRef[] {
  return kNodeValueKinds.map((kind) => {
    return { kind, id };
  });
}

export function materialValueRefs(
  id: string
): ModelValueRef[] {
  return [
    { kind: "material-name", id },
    { kind: "material-parent", id },
    ...MaterialSurface.KEYS.map((field): ModelValueRef => {
      return { kind: "material-surface", id, field };
    })
  ];
}
