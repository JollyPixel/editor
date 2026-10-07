// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import type { KeyBindingSettings } from "./KeyBindingSettings.ts";

export interface KeybindConsoleContext {
  keyBindingSettings: KeyBindingSettings;
}

export function keybindConsole(
  commands: CommandConsole,
  { keyBindingSettings }: KeybindConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("pixelart.keybinds", {
    description: "Pixel-art keyboard shortcuts"
  });
  const { actions } = keyBindingSettings.keyBindings;

  for (const action of actions) {
    namespace.registerVariable(action, {
      type: "string",
      description: `Shortcut for ${action}, comma-separated for several`,
      get: () => keyBindingSettings.bindingsOf(action).join(", "),
      set: (value) => {
        keyBindingSettings.assign(action, parseBindingList(value));
      }
    });
  }

  namespace.registerCommand("reset", {
    description: "Restore the default shortcut of one action, or of all",
    args: [
      {
        name: "action",
        type: "enum",
        enumValues: actions
      }
    ],
    execute: ({ action }, ctx) => {
      keyBindingSettings.reset(action);
      ctx.print(
        action === undefined ?
          "Every shortcut restored" :
          `${action} restored to ${
            keyBindingSettings.bindingsOf(action).join(", ")
          }`
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
