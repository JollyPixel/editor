// CONSTANTS
export const BOOT_MARKS = [
  "header",
  "home",
  "play",
  "kinds",
  "tree"
] as const;

export type BootMark = typeof BOOT_MARKS[number];
export type BootMarks = Partial<Record<BootMark, number>>;

declare global {
  interface Window {
    jollyBootMarks?: BootMarks;
  }
}

export function installBootProbe(): void {
  if (window.top !== window) {
    return;
  }

  const marks: BootMarks = {};
  const kDeadlineMs = 30_000;
  window.jollyBootMarks = marks;

  function inside(
    root: ParentNode | null | undefined,
    selector: string
  ): Element | null {
    return root?.querySelector(selector) ?? null;
  }

  function findShadow(
    root: ParentNode | null | undefined,
    selector: string
  ): ShadowRoot | null {
    return inside(root, selector)?.shadowRoot ?? null;
  }

  function hasOptions(
    group: Element | null
  ): boolean {
    return group !== null &&
      "options" in group &&
      Array.isArray(group.options) &&
      group.options.length > 0;
  }

  function mark(
    name: BootMark,
    reached: boolean
  ): void {
    if (reached && marks[name] === undefined) {
      marks[name] = Math.round(performance.now());
    }
  }

  function sample(): void {
    const studio = findShadow(document, "jolly-studio");
    const browser = findShadow(
      findShadow(studio, "studio-home"),
      "asset-browser"
    );
    const kinds = inside(browser, "jolly-button-group");
    mark("header", inside(
      findShadow(studio, "studio-header-actions"),
      "jolly-button"
    ) !== null);
    mark("home", inside(studio, "jolly-tab") !== null);
    mark("play", inside(
      findShadow(studio, "studio-play-button:not([hidden])"),
      "jolly-button"
    ) !== null);
    mark("kinds", hasOptions(kinds));
    mark("tree", inside(
      findShadow(browser, "jolly-tree"),
      "[role='treeitem']"
    ) !== null);
    if (performance.now() < kDeadlineMs) {
      requestAnimationFrame(sample);
    }
  }

  requestAnimationFrame(sample);
}
