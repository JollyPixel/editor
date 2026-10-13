// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import {
  INSPECTOR_MODES,
  type ViewStore
} from "../state/index.ts";

export interface ViewConsoleContext {
  state: {
    view: Pick<ViewStore, "settings" | "update">;
  };
}

export function viewConsole(
  commands: CommandConsole,
  { state: { view } }: ViewConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("view", {
    description: "Viewport aids"
  });

  namespace.registerVariable("grid", {
    type: "boolean",
    description: "Ground grid under the map",
    get: () => view.settings.grid,
    set: (grid) => {
      view.update({ grid });
    }
  });
  namespace.registerVariable("inspector", {
    type: "enum",
    description: "Chunk wireframe over the blocks, or wireframe only",
    enumValues: INSPECTOR_MODES,
    get: () => view.settings.inspector,
    set: (inspector) => {
      view.update({ inspector });
    }
  });
  namespace.registerVariable("chunkBounds", {
    type: "boolean",
    description: "Outline the bounds of every chunk",
    get: () => view.settings.chunkBounds,
    set: (chunkBounds) => {
      view.update({ chunkBounds });
    }
  });

  return namespace;
}
