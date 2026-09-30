// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import { KEYBINDING_ACTIONS } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { KeybindingSettings } from "./KeybindingSettings.ts";

export interface KeybindConsoleContext {
  keybindings: KeybindingSettings;
}

export function keybindConsole(
  commands: CommandConsole,
  { keybindings }: KeybindConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("keybind", {
    description: "Pixel-art keyboard shortcuts"
  });

  for (const action of KEYBINDING_ACTIONS) {
    namespace.registerVariable(action, {
      type: "string",
      description: `Shortcut for ${action}, comma-separated for several`,
      get: () => keybindings.bindingsOf(action).join(", "),
      set: (value) => {
        keybindings.assign(action, parseBindingList(value));
      }
    });
  }

  namespace.registerCommand("reset", {
    description: "Restore the default shortcut of one action, or of all",
    args: [
      {
        name: "action",
        type: "enum",
        enumValues: KEYBINDING_ACTIONS
      }
    ],
    execute: ({ action }, ctx) => {
      keybindings.reset(action);
      ctx.print(
        action === undefined ?
          "Every shortcut restored" :
          `${action} restored to ${keybindings.bindingsOf(action).join(", ")}`
      );
    }
  });

  return namespace;
}

export function parseBindingList(
  value: string
): string[] {
  return value
    .split(",")
    .map((binding) => binding.trim())
    .filter((binding) => binding !== "");
}
