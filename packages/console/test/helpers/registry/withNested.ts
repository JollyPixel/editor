// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";

export interface NestedSetup {
  commands: CommandConsole;
  bindings: Map<string, string>;
  resets: string[];
}

export function withNested(): NestedSetup {
  const commands = new CommandConsole();
  const bindings = new Map([
    ["undo", "mod+z"],
    ["redo", "mod+y"]
  ]);
  const resets: string[] = [];

  const keybinds = commands.registerNamespace("pixelart.keybinds", {
    description: "Pixel-art keyboard shortcuts"
  });
  for (const action of bindings.keys()) {
    keybinds.registerVariable(action, {
      type: "string",
      description: `Shortcut for ${action}`,
      get: () => bindings.get(action)!,
      set: (value) => {
        bindings.set(action, value);
      }
    });
  }
  keybinds.registerCommand("reset", {
    description: "Restore the default shortcuts",
    args: [],
    execute: () => {
      resets.push("pixelart.keybinds");
    }
  });
  commands.registerNamespace("pixelart.preview").registerVariable("rotate", {
    type: "boolean",
    description: "Spin the preview",
    get: () => false,
    set: () => undefined
  });
  commands.registerNamespace("brush").registerCommand("reset", {
    description: "Restore the default brush",
    args: [],
    execute: () => {
      resets.push("brush");
    }
  });

  return {
    commands,
    bindings,
    resets
  };
}
