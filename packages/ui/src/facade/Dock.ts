// Import Internal Dependencies
import { Dock } from "../containers/dock/Dock.ts";
import { DockLayout } from "../containers/dock/DockLayout.ts";

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

  static query(
    selector: string,
    root: ParentNode = document
  ): DockFacade {
    const element = root.querySelector(selector);
    if (!(element instanceof Dock)) {
      throw new Error(
        `DockFacade.query: "${selector}" matched no upgraded jolly-dock`
      );
    }

    return DockFacade.from(element);
  }

  get hidden(): boolean {
    return Boolean(this.element.hidden);
  }

  set hidden(
    value: boolean
  ) {
    this.element.hidden = value;
  }

  sync(): void {
    this.#layout.sync();
  }
}
