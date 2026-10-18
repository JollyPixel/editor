// Import Third-party Dependencies
import type {
  CommandConsole,
  ConsoleNamespace,
  RegistrationHandle
} from "@jolly-pixel/console";
import type { KeyBindingSettings } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { PixelArtKeyBindingSettings } from "./PixelArtKeyBindingSettings.ts";

export interface KeybindConsoleContext {
  keyBindingSettings: PixelArtKeyBindingSettings;
}

export function keybindConsole(
  commands: CommandConsole,
  { keyBindingSettings }: KeybindConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("pixelart.keybinds", {
    description: "Pixel-art keyboard shortcuts"
  });

  for (const action of keyBindingSettings.keyBindings.actions) {
    registerKeyBindingVariable(namespace, keyBindingSettings, action);
  }
  registerKeyBindingReset(namespace, keyBindingSettings);

  return namespace;
}

export function registerKeyBindingVariable<TAction extends string>(
  namespace: ConsoleNamespace,
  settings: KeyBindingSettings<TAction>,
  action: TAction,
  name: string = action
): RegistrationHandle {
  return namespace.registerVariable(name, {
    type: "string[]",
    description: `Shortcuts for ${action}`,
    get: () => settings.chordsBoundTo(action),
    set: (chords) => {
      settings.assign(action, chords);
    }
  });
}

export function registerKeyBindingReset<TAction extends string>(
  namespace: ConsoleNamespace,
  settings: KeyBindingSettings<TAction>
): RegistrationHandle {
  return namespace.registerCommand("reset", {
    description: "Restore the default shortcut of one action, or of all",
    args: [
      {
        name: "action",
        type: "enum",
        enumValues: settings.keyBindings.actions
      }
    ],
    execute: ({ action }, ctx) => {
      settings.reset(action);
      ctx.print(
        action === undefined ?
          "Every shortcut restored" :
          `${action} restored to ${
            settings.chordsBoundTo(action).join(" ") || "nothing"
          }`
      );
    }
  });
}
