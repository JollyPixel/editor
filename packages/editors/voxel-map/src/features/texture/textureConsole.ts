// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import { pixelArtConsole } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";

export function textureConsole(
  commands: CommandConsole,
  { state }: Pick<VoxelMapWorkspace, "state">
): RegistrationHandle {
  return pixelArtConsole(commands, {
    keyBindingSettings: state.pixelArtKeyBindings
  });
}
