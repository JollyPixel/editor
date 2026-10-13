// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

// Import Internal Dependencies
import type { RuntimeWidgets } from "../../runtime/RuntimeWidgets.ts";

export interface RuntimeConsoleContext {
  runtime: {
    readonly widgets: Pick<RuntimeWidgets, "mounted" | "visible" | "show">;
  };
}

export function runtimeConsole(
  commands: CommandConsole,
  { runtime: { widgets } }: RuntimeConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("runtime", {
    description: "Performance readouts and viewport gizmos"
  });

  if (widgets.mounted("stats")) {
    namespace.registerVariable("stats", {
      type: "boolean",
      description: "Frame time graph in the viewport corner",
      get: () => widgets.visible("stats"),
      set: (visible) => widgets.show("stats", visible)
    });
  }
  if (widgets.mounted("viewHelper")) {
    namespace.registerVariable("viewHelper", {
      type: "boolean",
      description: "Axis gizmo in the viewport corner",
      get: () => widgets.visible("viewHelper"),
      set: (visible) => widgets.show("viewHelper", visible)
    });
  }
  namespace.registerVariable("metrics", {
    type: "boolean",
    description: "Performance pane with the metric readouts",
    get: () => widgets.visible("metrics"),
    set: (visible) => widgets.show("metrics", visible)
  });

  return namespace;
}
