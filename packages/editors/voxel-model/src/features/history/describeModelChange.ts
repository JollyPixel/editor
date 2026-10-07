// Import Third-party Dependencies
import type { ModelChange } from "@jolly-pixel/asset.voxel-model/client";

export function describeModelChange(
  change: ModelChange
): string {
  const { command, image: { before } } = change;
  const node = before.nodes[0]?.name ?? "";
  const material = before.materials[0]?.name ?? "";

  switch (command.action) {
    case "node-added":
      return `Add ${command.node.name}`;
    case "node-removed":
      return `Delete ${node}`;
    case "node-renamed":
      return `Rename ${node}`;
    case "node-moved":
      return `Move ${node}`;
    case "node-transformed":
      return `Transform ${node}`;
    case "node-uv-changed":
      return `Edit UVs of ${node}`;
    case "node-material-changed":
      return `Set material of ${node}`;
    case "material-added":
      return `Add material ${command.material.name}`;
    case "material-folder-added":
      return `Add folder ${command.folder.name}`;
    case "material-removed":
      return `Delete ${material}`;
    case "material-moved":
      return `Move ${material}`;
    case "material-renamed":
      return `Rename ${material}`;
    case "material-changed":
      return `Edit ${material}`;
    case "animation-set-linked":
      return "Link animation set";
    case "animation-set-unlinked":
      return "Unlink animation set";
    case "animation-set-owned":
      return command.own ? "Keep animations on this model" : "Share animations as a set";
    case "animation-binding-changed":
      return `Bind track ${command.path}`;
    case "animation-binding-cleared":
      return `Unbind track ${command.path}`;
  }
}
