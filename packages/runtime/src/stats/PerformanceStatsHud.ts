// Import Third-party Dependencies
import type { ResolvedThemeMode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  Runtime,
  RuntimeOptions
} from "../Runtime.ts";
import type { MountedOverlay } from "../ui/overlay/OverlayLayer.ts";
import type { OverlayPosition } from "../ui/overlay/resolveOverlayAnchor.ts";

// CONSTANTS
const kStatsWidth = 112;
const kStatsHeight = 56;
const kDefaultStatsPosition = "top-left";
const kDefaultStatsInset = 8;

export type PerformanceStatsPosition = OverlayPosition;

export type PerformanceStatsHost = Pick<
  Runtime,
  "stats" | "overlay" | "loop" | "mountMetricsPanel"
>;

export type PerformanceStatsOption = Exclude<
  RuntimeOptions["includePerformanceStats"],
  false | undefined
>;

export interface PerformanceStatsPlacement {
  position: PerformanceStatsPosition;
  inset: number;
}

export class PerformanceStatsHud {
  #host: PerformanceStatsHost;
  #frame: HTMLElement;
  #badge: HTMLElement;
  #mounted: MountedOverlay;
  #unsubscribers: Array<() => void>;

  static async mount(
    host: PerformanceStatsHost,
    option: PerformanceStatsOption
  ): Promise<PerformanceStatsHud | null> {
    const settings = typeof option === "object" ? option : {};
    let hud: PerformanceStatsHud | null = null;

    if (settings.mount ?? true) {
      const { documentThemeMode } = await import("@jolly-pixel/ui");
      hud = new PerformanceStatsHud(
        host,
        {
          position: settings.position ?? kDefaultStatsPosition,
          inset: settings.inset ?? kDefaultStatsInset
        },
        documentThemeMode()
      );
    }

    if (settings.panel) {
      await host.mountMetricsPanel(
        settings.panel === true ? {} : settings.panel
      );
    }

    return hud;
  }

  constructor(
    host: PerformanceStatsHost,
    placement: PerformanceStatsPlacement,
    theme: ResolvedThemeMode | null
  ) {
    this.#host = host;
    const document = host.overlay.element.ownerDocument;

    const stats = document.createElement("jolly-stats");
    stats.recorder = host.stats;
    stats.style.width = "100%";
    stats.style.height = "100%";

    this.#badge = document.createElement("span");
    this.#badge.textContent = "IDLE";
    this.#badge.title = "Rendering paused until something changes";
    Object.assign(this.#badge.style, {
      position: "absolute",
      right: "4px",
      bottom: "4px",
      padding: "0 4px",
      borderRadius: "var(--jolly-radius-sm, 3px)",
      font: "bold 9px/14px Helvetica, Arial, sans-serif",
      letterSpacing: "0.04em",
      color: "var(--jolly-text-muted, rgb(160 160 160))",
      background: "var(--jolly-surface-raised, rgb(32 32 32 / 0.85))",
      pointerEvents: "none"
    });

    const frame = document.createElement("div");
    this.#frame = frame;
    Object.assign(frame.style, {
      position: "relative",
      boxSizing: "border-box",
      width: `${kStatsWidth}px`,
      height: `${kStatsHeight}px`,
      overflow: "hidden",
      borderRadius: "var(--jolly-radius-md, 6px)",
      background: "var(--jolly-surface-raised, rgb(128 128 128 / 0.15))",
      boxShadow: "var(--jolly-shadow-floating, 0 4px 16px rgb(0 0 0 / 30%))"
    });
    frame.append(stats, this.#badge);

    const scope = document.createElement("jolly-scope");
    scope.style.display = "contents";
    if (theme !== null) {
      scope.setAttribute("theme", theme);
    }
    scope.append(frame);

    this.#showIdle();
    this.#unsubscribers = [
      host.loop.subscribe("start", this.#showIdle),
      host.loop.subscribe("stop", this.#showIdle),
      host.loop.subscribe("sleep", this.#showIdle),
      host.loop.subscribe("wake", this.#showIdle)
    ];
    this.#mounted = host.overlay.mount(scope, {
      ...placement,
      interactive: true
    });
  }

  get hidden(): boolean {
    return this.#frame.hidden !== false;
  }

  set hidden(
    value: boolean
  ) {
    this.#frame.hidden = value;
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.#mounted.dispose();
  }

  readonly #showIdle = (): void => {
    this.#badge.hidden = !this.#host.loop.sleeping;
  };
}
