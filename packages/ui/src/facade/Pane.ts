// Import Internal Dependencies
import "../containers/pane/Pane.ts";
import "../containers/floating/Floating.ts";
import "../theme/components/ScopeHost.ts";
import { FacadeContainer } from "./Container.ts";
import { documentThemeMode } from "../theme/ambientTheme.ts";
import type {
  IconName,
  IconTone
} from "../icon/registry.ts";
import type { PresenceSource } from "../peer/PresenceSource.ts";
import {
  FacadeFolder,
  type FolderOptions
} from "./Folder.ts";

// CONSTANTS
const kDefaultLabelWidth = "16ch";

export interface PaneOptions {
  title?: string;
  /**
   * Identity the pane persists and reorders under, and what a
   * `jolly-pane-group` addresses it by. Required to join a group as a tab.
   */
  key?: string;
  icon?: IconName;
  tone?: IconTone;
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
   * In `container` mode only: wraps the pane in a `jolly-floating` inside the
   * container instead of appending it there. Pass a `jolly-dock-layout` as the
   * container to have it adopt the pane, which is what lets the window be
   * docked into one of its groups; the layout then owns the geometry.
   * @default false
   */
  floating?: boolean;
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
  /**
   * Width of the label column, as `--jolly-label-width`. A floating pane
   * defaults to `16ch`; a pane mounted in a container inherits its container's
   * scope, where the variable defaults to `auto` and every row sizes its own
   * label.
   */
  labelWidth?: string;
  hidden?: boolean;
  floatWidth?: number;
  floatHeight?: number;
}

export class Pane extends FacadeContainer {
  readonly element: HTMLElement;

  #pane: HTMLElementTagNameMap["jolly-pane"];
  #scope: HTMLElement | null = null;

  constructor(
    options: PaneOptions = {}
  ) {
    super();
    this.#pane = document.createElement("jolly-pane");
    this.#pane.heading = options.title ?? "";
    this.#pane.key = options.key ?? "";
    if (options.icon !== undefined) {
      this.#pane.icon = options.icon;
    }
    this.#pane.tone = options.tone ?? "";
    this.#pane.collapsible = options.collapsible ?? false;
    this.#pane.locked = options.locked ?? false;
    this.#pane.storageKey = options.storageKey ?? "";
    this.#pane.floatWidth = options.floatWidth;
    this.#pane.floatHeight = options.floatHeight;

    this.element = options.container === undefined
      ? this.#mountFloating(
        options.storageKey ?? "",
        options.labelWidth ?? kDefaultLabelWidth
      )
      : this.#mountInto(
        options.container,
        options,
        options.labelWidth
      );
    this.element.hidden = options.hidden ?? false;
  }

  get presence(): PresenceSource | null {
    return this.#pane.presence;
  }

  set presence(
    value: PresenceSource | null
  ) {
    this.#pane.presence = value;
  }

  override dispose(): void {
    super.dispose();
    this.#scope?.remove();
    this.#scope = null;
  }

  protected get contentHost(): HTMLElement {
    return this.#pane;
  }

  protected createFolder(
    options: FolderOptions
  ): FacadeFolder {
    return new FacadeFolder(options);
  }

  #mountInto(
    container: HTMLElement,
    options: PaneOptions,
    labelWidth: string | undefined
  ): HTMLElement {
    if (labelWidth !== undefined) {
      this.#pane.style.setProperty("--jolly-label-width", labelWidth);
    }
    if (options.floating !== true) {
      this.#pane.grow = options.grow ?? true;
      container.append(this.#pane);

      return this.#pane;
    }

    const frame = document.createElement("jolly-floating");
    frame.storageKey = options.storageKey ?? "";
    if (options.floatWidth !== undefined) {
      frame.width = options.floatWidth;
    }
    if (options.floatHeight !== undefined) {
      frame.height = options.floatHeight;
    }
    frame.append(this.#pane);
    container.append(frame);

    return frame;
  }

  #mountFloating(
    storageKey: string,
    labelWidth: string
  ): HTMLElement {
    const floating = document.createElement("jolly-floating");
    floating.storageKey = storageKey;
    floating.append(this.#pane);

    const scope = document.createElement("jolly-scope");
    scope.style.display = "contents";
    scope.style.setProperty("--jolly-label-width", labelWidth);
    const theme = documentThemeMode();
    if (theme !== null) {
      scope.setAttribute("theme", theme);
    }
    scope.append(floating);
    document.body.append(scope);
    this.#scope = scope;

    return floating;
  }
}
