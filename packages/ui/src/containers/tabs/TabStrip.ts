// Import Internal Dependencies
import type { TabsOrientation } from "./Tabs.ts";

export interface StripTab {
  key: string;
  disabled: boolean;
  fixed?: boolean;
}

export interface TabSegment {
  start: number;
  end: number;
}

export class TabStrip {
  readonly #tabs: readonly StripTab[];

  constructor(
    tabs: Iterable<StripTab>
  ) {
    this.#tabs = [...tabs];
  }

  active(
    requested: string
  ): string {
    if (this.#tabs.length === 0) {
      return requested;
    }

    const match = this.#tabs.find(
      (tab) => tab.key === requested && !tab.disabled
    );
    const fallback = this.#tabs.find((tab) => !tab.disabled) ?? this.#tabs[0];

    return (match ?? fallback).key;
  }

  navigate(
    key: string,
    current: number,
    orientation: TabsOrientation = "horizontal"
  ): number {
    const enabled = this.#tabs.flatMap(
      (tab, index) => (tab.disabled ? [] : [index])
    );
    if (enabled.length === 0) {
      return -1;
    }

    const backward = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const forward = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    switch (key) {
      case "Home":
        return enabled[0];
      case "End":
        return enabled[enabled.length - 1];
      case backward:
        return enabled.findLast((index) => index < current) ??
          enabled[enabled.length - 1];
      case forward:
        return enabled.find((index) => index > current) ?? enabled[0];
      default:
        return -1;
    }
  }

  segment(
    from: number
  ): TabSegment | null {
    const tabs = this.#tabs;
    if (from < 0 || from >= tabs.length || tabs[from].fixed === true) {
      return null;
    }

    let start = from;
    while (start > 0 && tabs[start - 1].fixed !== true) {
      start--;
    }
    let end = from + 1;
    while (end < tabs.length && tabs[end].fixed !== true) {
      end++;
    }

    return {
      start,
      end
    };
  }

  dropTarget(
    from: number,
    insertion: number
  ): number | null {
    const segment = this.segment(from);
    if (segment === null) {
      return null;
    }

    const clamped = Math.min(
      Math.max(insertion, 0),
      segment.end - segment.start
    ) + segment.start;
    const to = clamped > from ? clamped - 1 : clamped;

    return to === from ? null : to;
  }
}
