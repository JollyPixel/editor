// Import Internal Dependencies
import {
  FacadeBinding,
  type BindingOptions
} from "./Binding.ts";
import {
  FacadeButton,
  type ButtonOptions
} from "./Button.ts";
import { FacadeElement } from "./Element.ts";
import {
  adoptFacadeItem,
  FacadeItem,
  type FacadeOwner
} from "./FacadeItem.ts";
import type {
  FacadeFolder,
  FolderOptions
} from "./Folder.ts";
import {
  FacadeMonitor,
  type MonitorKey,
  type MonitorOptions
} from "./Monitor.ts";
import {
  monitorFieldEntries,
  type MonitorFields
} from "./monitorFields.ts";
import {
  FacadeNote,
  type NoteOptions
} from "./Note.ts";
import {
  Presence,
  type PresenceOptions
} from "./Presence.ts";
import { FacadeSeparator } from "./Separator.ts";
import {
  createThemePreferences,
  type FacadeThemePreferences,
  type ThemePreferencesOptions
} from "./ThemePreferences.ts";

export type { MonitorFields } from "./monitorFields.ts";

interface Refreshable {
  refresh(): void;
}

export interface Disposable {
  dispose(): void;
}

type RefreshableItem = FacadeItem & Refreshable;

export abstract class FacadeContainer extends FacadeItem {
  abstract override readonly element: HTMLElement;

  #children: FacadeItem[] = [];
  #refreshable: RefreshableItem[] = [];
  #owner: FacadeOwner = {
    release: (child) => this.#release(child)
  };

  protected abstract get contentHost(): HTMLElement;

  protected abstract createFolder(
    options: FolderOptions
  ): FacadeFolder;

  addFolder(
    options: FolderOptions = {}
  ): FacadeFolder {
    return this.#adoptRefreshable(
      this.createFolder(options)
    );
  }

  addBinding<TObject extends object, TKey extends keyof TObject>(
    object: TObject,
    key: TKey,
    options?: BindingOptions<TObject[TKey]>
  ): FacadeBinding<TObject, TKey> {
    return this.#adoptRefreshable(
      new FacadeBinding(object, key, options)
    );
  }

  addMonitor<TObject extends object, TKey extends MonitorKey<TObject>>(
    object: TObject,
    key: TKey,
    options?: MonitorOptions<TObject[TKey]>
  ): FacadeMonitor<TObject, TKey> {
    return this.#adoptRefreshable(
      new FacadeMonitor(object, key, options)
    );
  }

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
  ): FacadeButton {
    return this.#adopt(new FacadeButton(options));
  }

  addSeparator(): FacadeSeparator {
    return this.#adopt(new FacadeSeparator());
  }

  addNote(
    options: NoteOptions = {}
  ): FacadeNote {
    return this.#adopt(new FacadeNote(options));
  }

  addThemePreferences(
    options: ThemePreferencesOptions = {}
  ): FacadeThemePreferences {
    return this.#adopt(createThemePreferences(options));
  }

  addElement<TElement extends HTMLElement>(
    element: TElement
  ): FacadeElement<TElement> {
    return this.#adopt(new FacadeElement(element));
  }

  addPresence(
    options: PresenceOptions = {}
  ): Presence {
    return this.#adopt(new Presence(options));
  }

  disposeAll(): void {
    const children = this.#children;
    this.#children = [];
    this.#refreshable = [];
    for (const child of children) {
      child.dispose();
    }
  }

  refresh(): void {
    for (const child of this.#refreshable) {
      child.refresh();
    }
  }

  #adopt<TChild extends FacadeItem>(
    child: TChild
  ): TChild {
    this.contentHost.append(child.element);
    this.#children.push(child);
    adoptFacadeItem(child, this.#owner);

    return child;
  }

  #adoptRefreshable<TChild extends RefreshableItem>(
    child: TChild
  ): TChild {
    this.#refreshable.push(child);

    return this.#adopt(child);
  }

  #release(
    child: FacadeItem
  ): void {
    removeItem(this.#children, child);
    removeItem(this.#refreshable, child);
  }
}

function removeItem(
  items: FacadeItem[],
  child: FacadeItem
): void {
  const index = items.indexOf(child);
  if (index !== -1) {
    items.splice(index, 1);
  }
}
