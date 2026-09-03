// Import Internal Dependencies
import "../containers/Pane.ts";
import "../containers/Floating.ts";
import "../theme/components/ScopeHost.ts";
import { FacadeContainer } from "./Container.ts";
import { documentThemeMode } from "../theme/ambientTheme.ts";
import type { PresenceSource } from "../peer/PresenceSource.ts";
import {
  Folder,
  type FolderOptions
} from "./Folder.ts";

// CONSTANTS
const kDefaultLabelWidth = "16ch";

export interface PaneOptions {
  title?: string;
  /**
   * Mounts into an existing element, such as a `jolly-dock`, instead of
   * floating. The container's own subtree must already sit under a theme
   * scope; unlike the default floating window, `Pane` does not supply one.
   */
  container?: HTMLElement;
  /**
   * In `container` mode only: fills the container's available space and
   * scrolls its own content, instead of being sized to its content like a
   * second pane stacked below it. Ignored while floating.
   * @default true
   */
  grow?: boolean;
  /**
   * Folds the pane to its header. See `jolly-pane`'s own `collapsible`.
   * @default false
   */
  collapsible?: boolean;
  /**
   * Keeps the pane at its authored position when it belongs to a DockLayout.
   * @default false
   */
  locked?: boolean;
  /**
   * Namespace the pane and its floating window persist under. Without it the
   * namespace is derived from the page path and the title, so renaming the
   * pane drops what it remembered, and two pages sharing a path collide.
   */
  storageKey?: string;
}

export class Pane extends FacadeContainer {
  readonly element: HTMLElement;

  #pane: HTMLElementTagNameMap["jolly-pane"];

  constructor(
    options: PaneOptions = {}
  ) {
    super();
    this.#pane = document.createElement("jolly-pane");
    this.#pane.heading = options.title ?? "";
    this.#pane.collapsible = options.collapsible ?? false;
    this.#pane.locked = options.locked ?? false;
    this.#pane.storageKey = options.storageKey ?? "";

    this.element = options.container === undefined
      ? this.#mountFloating(options.storageKey ?? "")
      : this.#mountInto(options.container, options.grow ?? true);
  }

  get presence(): PresenceSource | null {
    return this.#pane.presence;
  }

  set presence(
    value: PresenceSource | null
  ) {
    this.#pane.presence = value;
  }

  protected get contentHost(): HTMLElement {
    return this.#pane;
  }

  protected createFolder(
    options: FolderOptions
  ): Folder {
    return new Folder(options);
  }

  #mountInto(
    container: HTMLElement,
    grow: boolean
  ): HTMLElement {
    this.#pane.grow = grow;
    container.append(this.#pane);

    return this.#pane;
  }

  #mountFloating(
    storageKey: string
  ): HTMLElement {
    const floating = document.createElement("jolly-floating");
    floating.storageKey = storageKey;
    floating.append(this.#pane);

    const scope = document.createElement("jolly-scope");
    scope.style.display = "contents";
    scope.style.setProperty("--jolly-label-width", kDefaultLabelWidth);
    const theme = documentThemeMode();
    if (theme !== null) {
      scope.setAttribute("theme", theme);
    }
    scope.append(floating);
    document.body.append(scope);

    return floating;
  }
}
