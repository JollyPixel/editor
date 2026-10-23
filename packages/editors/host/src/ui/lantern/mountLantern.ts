// Import Third-party Dependencies
import type { CommandConsole } from "@jolly-pixel/console";
import { Lantern } from "@jolly-pixel/lantern";
import "@jolly-pixel/lantern/element";
import {
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { tourConsole } from "../../console/namespaces/tour.ts";
import type { HostLogger } from "../../debug/readDebugLogger.ts";

export interface PageLantern {
  readonly lantern: Lantern;

  dispose(): void;
}

export interface MountLanternOptions {
  commands: CommandConsole;
  logger: HostLogger;
  /**
   * @default the first jolly-scope, or document.body
   */
  parent?: HTMLElement;
  /**
   * @default new LocalStorageAdapter()
   */
  storage?: StorageAdapter;
}

export function mountLantern(
  options: MountLanternOptions
): PageLantern {
  const {
    commands,
    logger,
    parent = document.querySelector<HTMLElement>("jolly-scope") ?? document.body,
    storage = new LocalStorageAdapter()
  } = options;

  const element = parent.ownerDocument.createElement("jolly-lantern");
  parent.append(element);

  const lantern = new Lantern({
    storage,
    page: parent.ownerDocument,
    autoStart: !navigator.webdriver,
    warn: (message) => logger.warn(message),
    present: (run) => {
      element.run = run;
    }
  });
  const namespace = tourConsole(commands, { lantern });

  return {
    lantern,
    dispose() {
      lantern.dispose();
      namespace.unregister();
      element.remove();
    }
  };
}
