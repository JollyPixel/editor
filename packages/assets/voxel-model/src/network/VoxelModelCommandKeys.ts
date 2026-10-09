// Import Third-party Dependencies
import { TrackPath } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import { MaterialSurface } from "../model/materials/MaterialSurface.ts";
import type {
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "./types.ts";

type KeyedCommand = VoxelModelCommand | VoxelModelNetworkCommand;

export type ModelValueRef =
  | { kind: "name" | "parent" | "transform" | "uv" | "material" | "flip"; id: string; }
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

export function modelConflictRefs(
  command: KeyedCommand
): ModelValueRef[] {
  switch (command.action) {
    case "node-removed":
      return nodeValueRefs(command.id);
    case "node-moved":
      return [
        { kind: "parent", id: command.id },
        ...command.transforms.map(({ id }): ModelValueRef => {
          return { kind: "transform", id };
        })
      ];
    case "node-transformed":
      return [{ kind: "transform", id: command.id }];
    case "material-removed":
      return materialValueRefs(command.id);
    case "material-moved":
      return [{ kind: "material-parent", id: command.id }];
    case "node-renamed":
    case "node-uv-changed":
    case "node-material-changed":
    case "material-renamed":
    case "material-changed":
    case "animation-set-owned":
    case "animation-binding-changed":
    case "animation-binding-cleared":
      return modelWriteRefs(command) ?? [];
    case "node-added":
    case "material-added":
    case "material-folder-added":
    case "animation-set-linked":
    case "animation-set-unlinked":
      return [];
  }
}

export function modelWriteRefs(
  command: KeyedCommand
): ModelValueRef[] | null {
  switch (command.action) {
    case "node-renamed":
      return [{ kind: "name", id: command.id }];
    case "node-transformed":
      return command.flipAxes === undefined ?
        [{ kind: "transform", id: command.id }] :
        [{ kind: "transform", id: command.id }, { kind: "flip", id: command.id }];
    case "node-uv-changed":
      return [{ kind: "uv", id: command.id }];
    case "node-material-changed":
      return [{ kind: "material", id: command.id }];
    case "material-renamed":
      return [{ kind: "material-name", id: command.id }];
    case "material-changed":
      return Object.keys(command.surface).map((field) => {
        return { kind: "material-surface", id: command.id, field };
      });
    case "animation-set-owned":
      return [{ kind: "animation-own", id: command.id }];
    case "animation-binding-changed":
    case "animation-binding-cleared":
      return [{ kind: "animation-binding", id: command.id, path: command.path }];
    case "node-added":
    case "node-removed":
    case "node-moved":
    case "material-added":
    case "material-folder-added":
    case "material-moved":
    case "material-removed":
    case "animation-set-linked":
    case "animation-set-unlinked":
      return null;
  }
}

export function voxelModelConflictKeys(
  command: KeyedCommand
): string[] {
  return modelConflictRefs(command).map(modelValueKey);
}

export function voxelModelWriteKeys(
  command: KeyedCommand
): string[] | null {
  return modelWriteRefs(command)?.map(modelValueKey) ?? null;
}

function nodeValueRefs(
  id: string
): ModelValueRef[] {
  return (["name", "parent", "transform", "uv", "material"] as const).map((kind) => {
    return { kind, id };
  });
}

function materialValueRefs(
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
