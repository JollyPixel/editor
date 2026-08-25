// Import Internal Dependencies
import "../containers/Pane.ts";
import "../containers/Floating.ts";
import "../theme/components/ScopeHost.ts";
import { FacadeContainer } from "./Container.ts";
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
}

/**
 * The facade's entry point. With no `container`, a `jolly-pane` floats in a
 * self-scoped `jolly-floating` window appended to `document.body`, matching
 * Tweakpane's own default and needing no theme setup from the caller.
 */
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

    this.element = options.container === undefined
      ? this.#mountFloating()
      : this.#mountInto(options.container, options.grow ?? true);
  }

  /**
   * Collaboration source served to every field in this pane.
   */
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

  /**
   * `jolly-pane` reads inherited tokens but declares none itself (only
   * `jolly-dialog` self-scopes), and a body-appended element sits outside
   * every shadow root the page owns. `jolly-scope` is `Pane`'s own scope,
   * so a floating window is themed with no setup from the caller.
   */
  #mountFloating(): HTMLElement {
    const floating = document.createElement("jolly-floating");
    floating.append(this.#pane);

    const scope = document.createElement("jolly-scope");
    scope.style.display = "contents";
    scope.style.setProperty("--jolly-label-width", kDefaultLabelWidth);
    scope.append(floating);
    document.body.append(scope);

    return floating;
  }
}
