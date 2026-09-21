// Import Third-party Dependencies
import {
  Pane,
  type FacadeContainer,
  type FacadeFolder
} from "@jolly-pixel/ui";
import {
  resolveMetricFormat,
  type StatsRecorder,
  type StatsSnapshot
} from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import { groupMetrics } from "./groupMetrics.ts";

// CONSTANTS
const kDefaultTitle = "Performance";

export interface MetricsPanelKeyboard {
  on(
    type: string,
    handler: (event: KeyboardEvent) => void
  ): unknown;
  off(
    type: string,
    handler: (event: KeyboardEvent) => void
  ): void;
}

export interface MetricsPanelOptions {
  /**
   * Where the readout lives. An `HTMLElement` receives a pane of its own, a
   * `FacadeContainer` takes the folders directly so the readout merges into a
   * pane the caller already owns, and nothing at all floats above the page.
   */
  target?: HTMLElement | FacadeContainer;
  /**
   * With an `HTMLElement` target: floats the pane inside it rather than
   * appending it there. Pass the `jolly-dock-layout` to have it adopt the
   * window, so it can be docked into one of its groups.
   * @default false
   */
  floating?: boolean;
  /**
   * Identity the pane persists and docks under. Required to dock it.
   */
  key?: string;
  title?: string;
  storageKey?: string;
  /**
   * Key code toggling the readout, as `KeyboardEvent.code`.
   */
  toggleKey?: string;
  keyboard?: MetricsPanelKeyboard;
  hidden?: boolean;
  /**
   * @default true
   */
  collapsible?: boolean;
}

interface PanelItem {
  hidden: boolean;
  refresh(): void;
  dispose(): void;
}

export class MetricsPanel {
  readonly container: FacadeContainer;

  #recorder: StatsRecorder;
  #pane: Pane | null = null;
  #keyboard: MetricsPanelKeyboard | null = null;
  #toggleKey: string | null = null;
  #items: PanelItem[] = [];
  #values: StatsSnapshot = {};
  #revision = -1;
  #hidden: boolean;
  #unsubscribe: (() => void) | null = null;

  #onToggleKey = (
    event: KeyboardEvent
  ): void => {
    if (event.repeat) {
      return;
    }

    this.hidden = !this.hidden;
  };

  constructor(
    recorder: StatsRecorder,
    options: MetricsPanelOptions = {}
  ) {
    this.#recorder = recorder;
    this.#hidden = options.hidden ?? false;

    const { target } = options;
    if (target !== undefined && !(target instanceof HTMLElement)) {
      this.container = target;
    }
    else {
      this.#pane = new Pane({
        title: options.title ?? kDefaultTitle,
        key: options.key,
        container: target,
        floating: options.floating,
        storageKey: options.storageKey,
        collapsible: options.collapsible ?? true,
        hidden: this.#hidden
      });
      this.container = this.#pane;
    }

    this.#sync(recorder.snapshot());
    this.#unsubscribe = recorder.subscribe(
      (snapshot) => this.#sync(snapshot)
    );

    const { keyboard, toggleKey } = options;
    if (keyboard !== undefined && toggleKey !== undefined) {
      this.#keyboard = keyboard;
      this.#toggleKey = toggleKey;
      keyboard.on(toggleKey, this.#onToggleKey);
    }
  }

  get hidden(): boolean {
    return this.#pane === null ? this.#hidden : this.#pane.hidden;
  }

  set hidden(
    value: boolean
  ) {
    this.#hidden = value;
    if (this.#pane === null) {
      for (const item of this.#items) {
        item.hidden = value;
      }

      return;
    }

    this.#pane.hidden = value;
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#keyboard !== null && this.#toggleKey !== null) {
      this.#keyboard.off(this.#toggleKey, this.#onToggleKey);
    }
    this.#keyboard = null;
    this.#clear();
    this.#pane?.dispose();
    this.#pane = null;
  }

  #sync(
    snapshot: StatsSnapshot
  ): void {
    Object.assign(this.#values, snapshot);
    if (this.#revision !== this.#recorder.revision) {
      this.#build();
    }
    for (const item of this.#items) {
      item.refresh();
    }
  }

  #build(): void {
    this.#clear();
    this.#revision = this.#recorder.revision;

    for (const group of groupMetrics(this.#recorder.definitions)) {
      const parent: FacadeContainer = group.title === null ?
        this.container :
        this.#addFolder(group.title);

      for (const definition of group.metrics) {
        this.#values[definition.id] ??= 0;
        const monitor = parent.addMonitor(this.#values, definition.id, {
          label: definition.label,
          format: resolveMetricFormat(definition)
        });
        if (parent === this.container) {
          this.#items.push(monitor);
        }
      }
    }
    if (this.#pane === null) {
      this.hidden = this.#hidden;
    }
  }

  #addFolder(
    title: string
  ): FacadeFolder {
    const folder = this.container.addFolder({ title });
    this.#items.push(folder);

    return folder;
  }

  #clear(): void {
    for (const item of this.#items) {
      item.dispose();
    }
    this.#items = [];
  }
}
