// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import { pixelArtConsole } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
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
    enumValues: state.uvSync.values,
    get: () => state.uvSync.value,
    set: (mode) => {
      state.uvSync.value = mode;
    }
  });

  namespace.registerVariable("tabs", {
    type: "enum",
    description: "Blockset tabs drawn as labelled tabs or as a thin line",
    enumValues: state.textureTabs.values,
    get: () => state.textureTabs.value,
    set: (style) => {
      state.textureTabs.value = style;
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
