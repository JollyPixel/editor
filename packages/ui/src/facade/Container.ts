// Import Internal Dependencies
import {
  Binding,
  type BindingOptions
} from "./Binding.ts";
import {
  Button,
  type ButtonOptions
} from "./Button.ts";
/*
 * Type only: `Folder` extends `FacadeContainer`, so a value import here would
 * make each module need the other fully evaluated before its own class body
 * runs. `createFolder` asks each subclass for the value instead.
 */
import type {
  Folder,
  FolderOptions
} from "./Folder.ts";
import {
  Monitor,
  type MonitorKey,
  type MonitorOptions
} from "./Monitor.ts";
import {
  monitorFieldEntries,
  type MonitorFields
} from "./monitorFields.ts";
import {
  Presence,
  type PresenceOptions
} from "./Presence.ts";
import { Separator } from "./Separator.ts";

export type { MonitorFields } from "./monitorFields.ts";

interface Refreshable {
  refresh(): void;
}

/**
 * Every facade builder — `Pane`, `Folder`, `Binding`, `Monitor`, `Button`, and
 * the object `addSeparator()` returns — satisfies this, for a consumer that
 * collects a mixed batch to dispose together (Tweakpane's own `BladeApi`).
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Shared `addFolder`/`addBinding`/`addMonitor`/`addButton`/`addSeparator` surface
 * for `Pane` and `Folder`. Children append to `contentHost`, which differs
 * from the public `element` only for `Pane`'s floating wrap.
 */
export abstract class FacadeContainer {
  abstract readonly element: HTMLElement;

  #children: Disposable[] = [];
  #refreshable: Refreshable[] = [];

  protected abstract get contentHost(): HTMLElement;

  protected abstract createFolder(
    options: FolderOptions
  ): Folder;

  addFolder(
    options: FolderOptions = {}
  ): Folder {
    const folder = this.createFolder(options);
    this.contentHost.append(folder.element);
    this.#children.push(folder);
    this.#refreshable.push(folder);

    return folder;
  }

  addBinding<TObject extends object, TKey extends keyof TObject>(
    object: TObject,
    key: TKey,
    options?: BindingOptions<TObject[TKey]>
  ): Binding<TObject, TKey> {
    const binding = new Binding(object, key, options);
    this.contentHost.append(binding.element);
    this.#children.push(binding);
    this.#refreshable.push(binding);

    return binding;
  }

  addMonitor<TObject extends object, TKey extends MonitorKey<TObject>>(
    object: TObject,
    key: TKey,
    options?: MonitorOptions
  ): Monitor<TObject, TKey> {
    const monitor = new Monitor(object, key, options);
    this.contentHost.append(monitor.element);
    this.#children.push(monitor);
    this.#refreshable.push(monitor);

    return monitor;
  }

  /** Adds monitors for each configured number or string property. */
  addMonitors<TObject extends object>(
    object: TObject,
    fields: MonitorFields<TObject>
  ): void {
    for (const [key, options] of monitorFieldEntries(fields)) {
      this.addMonitor(object, key, options);
    }
  }

  addButton(
    options?: ButtonOptions
  ): Button {
    const button = new Button(options);
    this.contentHost.append(button.element);
    this.#children.push(button);

    return button;
  }

  addSeparator(): Separator {
    const separator = new Separator();
    this.contentHost.append(separator.element);
    this.#children.push(separator);

    return separator;
  }

  addPresence(
    options: PresenceOptions = {}
  ): Presence {
    const presence = new Presence(options);
    this.contentHost.append(presence.element);
    this.#children.push(presence);

    return presence;
  }

  /** Disposes every direct builder this container created and starts empty. */
  disposeAll(): void {
    for (const child of this.#children) {
      child.dispose();
    }
    this.#children = [];
    this.#refreshable = [];
  }

  /** Cascades to every bound `Folder`, `Binding`, and `Monitor` added so far. */
  refresh(): void {
    for (const child of this.#refreshable) {
      child.refresh();
    }
  }

  get hidden(): boolean {
    return Boolean(this.element.hidden);
  }

  set hidden(
    value: boolean
  ) {
    this.element.hidden = value;
  }

  get disabled(): boolean {
    return this.element.hasAttribute("disabled");
  }

  set disabled(
    value: boolean
  ) {
    this.element.toggleAttribute("disabled", value);
  }

  dispose(): void {
    this.element.remove();
  }
}
