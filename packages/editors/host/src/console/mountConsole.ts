// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import "@jolly-pixel/console/element";
import {
  DENSITIES,
  LocalStorageAdapter,
  THEME_MODES,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PageAppearance,
  type Appearance
} from "../appearance/PageAppearance.ts";
import { StoredAppearance } from "../appearance/StoredAppearance.ts";

export interface PageConsole {
  readonly commands: CommandConsole;

  dispose(): void;
}

export interface EditorConsole extends PageConsole {
  readonly element: HTMLElementTagNameMap["jolly-console"];
}

export interface MountConsoleOptions {
  /**
   * @default document.body
   */
  parent?: HTMLElement;
  /**
   * @default new LocalStorageAdapter()
   */
  storage?: StorageAdapter;
  /**
   * What the `theme` and `density` variables read and write. Without it,
   * the page restores and stores them in `storage`.
   */
  appearance?: Appearance;
}

export function mountConsole(
  options: MountConsoleOptions = {}
): EditorConsole {
  const {
    parent = document.body,
    storage = new LocalStorageAdapter()
  } = options;

  const appearance = options.appearance ??
    restoredAppearance(parent.ownerDocument, storage);

  const commands = new CommandConsole();
  registerAppearanceVariables(commands, appearance);

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

function restoredAppearance(
  document: Document,
  storage: StorageAdapter
): Appearance {
  const appearance = new StoredAppearance({
    page: new PageAppearance(document),
    storage
  });
  appearance.restore();

  return appearance;
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
