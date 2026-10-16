// Import Third-party Dependencies
import type {
  MetricsPanel,
  PerformanceStatsHud,
  ViewHelperSettings
} from "@jolly-pixel/runtime";
import type { StorageAdapter } from "@jolly-pixel/ui";
import * as z from "zod/mini";

// CONSTANTS
const kStorageKey = "jolly-pixel:runtime-widgets";
const kWidgets = [
  "stats",
  "viewHelper",
  "metrics"
] as const;
const kStoredFlag = z.catch(z.optional(z.boolean()), undefined);
const kStoredVisibilitySchema = z.catch(z.object({
  stats: kStoredFlag,
  viewHelper: kStoredFlag,
  metrics: kStoredFlag
}), {});
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

type StoredVisibility = Partial<Record<RuntimeWidget, boolean>>;

export class RuntimeWidgets {
  #storage: StorageAdapter;
  #stored: StoredVisibility;
  #targets: Readonly<Record<RuntimeWidget, () => Visibility | null>>;

  constructor(
    host: RuntimeWidgetHost,
    storage: StorageAdapter
  ) {
    this.#storage = storage;
    this.#stored = parseStoredVisibility(storage.get(kStorageKey));
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
    widget: RuntimeWidget,
    fallback: boolean
  ): boolean {
    const visible = this.#stored[widget];

    return visible === undefined ? fallback : !visible;
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
    this.#stored = {
      ...this.#stored,
      [widget]: visible
    };
    this.#storage.set(kStorageKey, JSON.stringify(this.#stored));
  }

  restore(): void {
    for (const widget of kWidgets) {
      const visible = this.#stored[widget];
      if (visible === undefined) {
        continue;
      }

      const target = this.#targets[widget]();
      if (target !== null) {
        target.hidden = !visible;
      }
    }
  }
}

function parseStoredVisibility(
  raw: string | null
): StoredVisibility {
  try {
    return kStoredVisibilitySchema.parse(
      raw === null ? null : JSON.parse(raw)
    );
  }
  catch {
    return {};
  }
}
