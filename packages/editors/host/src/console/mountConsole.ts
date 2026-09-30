// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import "@jolly-pixel/console/element";

// Import Internal Dependencies
import { registerThemeVariable } from "./themeVariable.ts";

export interface EditorConsole {
  readonly commands: CommandConsole;
  readonly element: HTMLElementTagNameMap["jolly-console"];

  dispose(): void;
}

export function mountConsole(
  parent: HTMLElement = document.body
): EditorConsole {
  const commands = new CommandConsole();
  registerThemeVariable(commands, parent.ownerDocument);

  const element = parent.ownerDocument.createElement("jolly-console");
  element.console = commands;
  parent.append(element);

  return {
    commands,
    element,
    dispose() {
      element.remove();
      commands.unregister();
    }
  };
}
