// Import Third-party Dependencies
import {
  trackBlockName,
  type AnimationChange
} from "@jolly-pixel/asset.voxel-animation/client";

export function describeAnimationChange(
  change: AnimationChange
): string {
  const { command, image } = change;
  const clip = image.clips.values().next().value?.name ?? "";

  switch (command.action) {
    case "rig-renamed":
      return "Rename rig";
    case "clip-added":
      return `Add clip ${command.clip.name}`;
    case "clip-removed":
      return `Delete clip ${clip}`;
    case "clip-changed":
      return `${command.patch.name === undefined ? "Edit" : "Rename"} clip ${clip}`;
    case "clip-moved":
      return `Move clip ${clip}`;
    case "key-set":
      return `Key ${trackBlockName(command.path)}`;
    case "key-removed":
      return `Delete key of ${trackBlockName(command.path)}`;
    case "track-removed":
      return `Delete track ${trackBlockName(command.path)}`;
    case "track-renamed":
      return `Rename track ${trackBlockName(command.path)}`;
  }
}
