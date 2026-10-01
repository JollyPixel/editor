// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import "@jolly-pixel/console/element";
import {
  DENSITIES,
  THEME_MODES
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PageAppearance,
  type Appearance
} from "../appearance/PageAppearance.ts";

export interface PageConsole {
  readonly commands: CommandConsole;

  dispose(): void;
}

export interface EditorConsole extends PageConsole {
  readonly element: HTMLElementTagNameMap["jolly-console"];
}

export function mountConsole(
  parent: HTMLElement = document.body
): EditorConsole {
  const commands = new CommandConsole();
  registerAppearanceVariables(
    commands,
    new PageAppearance(parent.ownerDocument)
  );

  const element = parent.ownerDocument.createElement(
    "jolly-console"
  );
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

function registerAppearanceVariables(
  commands: CommandConsole,
  appearance: Appearance
): void {
  commands.registerVariable("theme", {
    type: "enum",
    description: "Theme of the page, light, dark or auto to follow the system",
    enumValues: THEME_MODES,
    get: () => appearance.theme,
    set: (theme) => {
      appearance.theme = theme;
    }
  });
  commands.registerVariable("density", {
    type: "enum",
    description: "Density of the page, compact, default or comfortable",
    enumValues: DENSITIES,
    get: () => appearance.density,
    set: (density) => {
      appearance.density = density;
    }
  });
}
