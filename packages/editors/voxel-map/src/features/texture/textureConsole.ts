// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import { pixelArtConsole } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import { UV_SYNC_MODES } from "../../state/index.ts";
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";

export type TextureConsoleContext = Pick<VoxelMapWorkspace, "state">;

export function textureConsole(
  commands: CommandConsole,
  { state }: TextureConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("texture", {
    description: "Blockset texture panel"
  });

  namespace.registerVariable("uvSync", {
    type: "enum",
    description: "Live rewrites the blocks while a UV is dragged, " +
      "commit only once it is dropped",
    enumValues: UV_SYNC_MODES,
    get: () => state.uvSync.mode,
    set: (mode) => {
      state.uvSync.mode = mode;
    }
  });

  return namespace;
}

export function textureShortcutsConsole(
  commands: CommandConsole,
  { state }: TextureConsoleContext
): RegistrationHandle {
  return pixelArtConsole(commands, {
    keyBindingSettings: state.pixelArtKeyBindings
  });
}
