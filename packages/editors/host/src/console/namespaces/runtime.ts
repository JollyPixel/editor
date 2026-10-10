// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import type {
  MetricsPanel,
  PerformanceStatsHud,
  ViewHelperSettings
} from "@jolly-pixel/runtime";

export interface RuntimeConsoleContext {
  runtime: {
    readonly statsHud: Pick<PerformanceStatsHud, "hidden"> | null;
    readonly viewHelper: Pick<ViewHelperSettings, "hidden"> | null;
    readonly metrics: {
      readonly panel: Pick<MetricsPanel, "hidden"> | null;
    };
  };
}

export function runtimeConsole(
  commands: CommandConsole,
  { runtime }: RuntimeConsoleContext
): RegistrationHandle {
  const namespace = commands.registerNamespace("runtime", {
    description: "Performance readouts and viewport gizmos"
  });

  const { statsHud, viewHelper, metrics } = runtime;
  if (statsHud !== null) {
    namespace.registerVariable("stats", {
      type: "boolean",
      description: "Frame time graph in the viewport corner",
      get: () => !statsHud.hidden,
      set: (visible) => {
        statsHud.hidden = !visible;
      }
    });
  }
  if (viewHelper !== null) {
    namespace.registerVariable("viewHelper", {
      type: "boolean",
      description: "Axis gizmo in the viewport corner",
      get: () => !viewHelper.hidden,
      set: (visible) => {
        viewHelper.hidden = !visible;
      }
    });
  }
  namespace.registerVariable("metrics", {
    type: "boolean",
    description: "Performance pane with the metric readouts",
    get: () => metrics.panel?.hidden === false,
    set: (visible) => {
      const { panel } = metrics;
      if (panel === null) {
        throw new Error("No performance pane is mounted.");
      }

      panel.hidden = !visible;
    }
  });

  return namespace;
}
