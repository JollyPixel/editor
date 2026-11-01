// Import Third-party Dependencies
import type {
  MetricsPanel,
  PerformanceStatsHud,
  ViewHelperSettings
} from "@jolly-pixel/runtime";
import type {
  Preferences,
  PreferenceValues
} from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { RUNTIME_PREFERENCES } from "../preferences/hostPreferences.ts";

// CONSTANTS
const kWidgets = [
  "stats",
  "viewHelper",
  "metrics"
] as const;
const kMissingMessages: Readonly<Record<RuntimeWidget, string>> = {
  stats: "No performance HUD is mounted.",
  viewHelper: "No view helper is mounted.",
  metrics: "No performance pane is mounted."
};

export type RuntimeWidget = typeof kWidgets[number];

export interface RuntimeWidgetHost {
  readonly statsHud: Pick<PerformanceStatsHud, "hidden"> | null;
  readonly viewHelper: Pick<ViewHelperSettings, "hidden"> | null;
  readonly metrics: {
    readonly panel: Pick<MetricsPanel, "hidden"> | null;
  };
}

interface Visibility {
  hidden: boolean;
}

type WidgetValues = PreferenceValues<typeof RUNTIME_PREFERENCES.fields>;

export class RuntimeWidgets {
  #preferences: Preferences | null = null;
  #unwatch: (() => void) | null = null;
  #targets: Readonly<Record<RuntimeWidget, () => Visibility | null>>;

  constructor(
    host: RuntimeWidgetHost
  ) {
    this.#targets = {
      stats: () => host.statsHud,
      viewHelper: () => host.viewHelper,
      metrics: () => host.metrics.panel
    };
  }

  mounted(
    widget: RuntimeWidget
  ): boolean {
    return this.#targets[widget]() !== null;
  }

  visible(
    widget: RuntimeWidget
  ): boolean {
    return this.#targets[widget]()?.hidden === false;
  }

  startsHidden(
    widget: RuntimeWidget
  ): boolean {
    return !this.#values()[widget];
  }

  show(
    widget: RuntimeWidget,
    visible: boolean
  ): void {
    const target = this.#targets[widget]();
    if (target === null) {
      throw new Error(kMissingMessages[widget]);
    }

    target.hidden = !visible;
    this.#preferences?.assign(RUNTIME_PREFERENCES, widget, visible);
  }

  follow(
    preferences: Preferences
  ): void {
    this.#unwatch?.();
    this.#preferences = preferences;
    this.#apply(this.#values());
    this.#unwatch = preferences.watch(RUNTIME_PREFERENCES, this.#apply);
  }

  #values(): WidgetValues {
    return this.#preferences?.values(RUNTIME_PREFERENCES) ??
      RUNTIME_PREFERENCES.defaults;
  }

  readonly #apply = (
    values: WidgetValues
  ): void => {
    for (const widget of kWidgets) {
      const target = this.#targets[widget]();
      if (target !== null) {
        target.hidden = !values[widget];
      }
    }
  };
}
