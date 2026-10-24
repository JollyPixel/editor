// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import {
  DENSITIES,
  LocalStorageAdapter,
  THEME_MODES,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  readDebugLogger,
  type HostLogger
} from "../debug/readDebugLogger.ts";
import { LazyConsoleElement } from "./LazyConsoleElement.ts";
import {
  PageAppearance,
  type Appearance
} from "../preferences/appearance/PageAppearance.ts";
import { StoredAppearance } from "../preferences/appearance/StoredAppearance.ts";

export interface PageConsole {
  readonly commands: CommandConsole;

  dispose(): void;
}

export interface EditorConsole extends PageConsole {
  toggle(): void;
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
  /**
   * @default readDebugLogger()
   */
  logger?: HostLogger;
}

export function mountConsole(
  options: MountConsoleOptions = {}
): EditorConsole {
  const {
    parent = document.body,
    storage = new LocalStorageAdapter(),
    logger = readDebugLogger()
  } = options;

  const appearance = options.appearance ??
    restoredAppearance(parent.ownerDocument, storage);

  const commands = new CommandConsole();
  registerAppearanceVariables(commands, appearance);

  const lazyElement = new LazyConsoleElement(
    commands,
    parent,
    (message) => logger.warn(message)
  );

  return {
    commands,
    toggle() {
      lazyElement.toggle();
    },
    dispose() {
      lazyElement.dispose();
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
