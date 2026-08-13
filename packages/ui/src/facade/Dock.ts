// Import Internal Dependencies
import { DockLayout } from "../containers/DockLayout.ts";

/**
 * Facade for an authored dock that belongs to a `jolly-dock-layout`.
 *
 * It intentionally does not create dock markup. Use it where HTML owns the
 * layout and code adds panes or controls after it has upgraded.
 */
export class DockFacade {
  readonly element: HTMLElementTagNameMap["jolly-dock"];

  #layout: DockLayout;

  constructor(
    element: HTMLElementTagNameMap["jolly-dock"],
    layout: DockLayout
  ) {
    this.element = element;
    this.#layout = layout;
  }

  static from(
    element: HTMLElementTagNameMap["jolly-dock"]
  ): DockFacade {
    const layout = element.closest("jolly-dock-layout");
    if (!(layout instanceof DockLayout)) {
      throw new Error(
        "DockFacade.from: dock must belong to an upgraded jolly-dock-layout"
      );
    }

    return new DockFacade(element, layout);
  }

  get hidden(): boolean {
    return Boolean(this.element.hidden);
  }

  set hidden(
    value: boolean
  ) {
    this.element.hidden = value;
  }

  /** Reconciles panes added after the layout's initial render. */
  sync(): void {
    this.#layout.sync();
  }
}
