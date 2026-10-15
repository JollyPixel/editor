# Facade API

The facade builds the package's custom elements from JavaScript and binds
them to object properties.

```ts
import {
  DockFacade,
  Pane
} from "@jolly-pixel/ui";
```

- [`Pane`](./pane.md): the entry point, and `FacadeHost` for an existing
  element.
- [`DockFacade`](./dock.md): wraps an authored `jolly-dock`.
- [Folders](./folder.md): group builders.
- [Bindings](./binding.md): edit object properties.
- [Monitors](./monitor.md): display object properties.
- [Buttons and separators](./actions.md).
- [Notes, elements and theme preferences](./content.md).
- [Presence](./presence.md): peer snapshots.

A walkthrough is in [Using the facade](../../guides/using-the-facade.md).

## Builder surface

Every builder shares this surface, from the `FacadeItem` base:

```ts
interface FacadeItem extends Disposable {
  readonly element: HTMLElement;
  hidden: boolean;
  disabled: boolean;
  dispose(): void;
}
```

- `disabled` writes the native property on buttons and bound fields, and the
  `disabled` attribute on other builders.
- Disposing a builder detaches it from the container that created it.

## Containers

`Pane`, `FacadeFolder` and `FacadeHost` hold child builders. They share
`FacadeContainer`:

```ts
interface FacadeContainer extends FacadeItem {
  addFolder(options?: FolderOptions): FacadeFolder;
  addBinding(object, key, options?: BindingOptions): FacadeBinding;
  addMonitor(object, key, options?: MonitorOptions): FacadeMonitor;
  addMonitors(object, fields: MonitorFields): void;
  addButton(options?: ButtonOptions): FacadeButton;
  addSeparator(): FacadeSeparator;
  addNote(options?: NoteOptions): FacadeNote;
  addThemePreferences(options?): FacadeThemePreferences;
  addElement<TElement>(element: TElement): FacadeElement<TElement>;
  addPresence(options?: PresenceOptions): Presence;
  refresh(): void;
  disposeAll(): void;
}
```

- Facade bindings do not observe assignments. `refresh()` re-reads the
  bindings and monitors the container created, nested folders included.
- `disposeAll()` disposes the direct child builders and clears the list.
- Elements appended to `element` by hand are not tracked: `disposeAll()`
  leaves them. Use `addElement()` instead.

## Exported types

- Builders: `FacadeFolder`, `FacadeBinding`, `FacadeMonitor`, `FacadeButton`,
  `FacadeSeparator`, `FacadeNote`, `FacadeThemePreferences`, `FacadeElement`,
  `Presence`. The `Facade` prefix avoids clashing with element classes.
- Bases, as types: `FacadeItem`, `FacadeContainer`, `Disposable`.
- Options: `PaneOptions`, `FolderOptions`, `BindingOptions`, `DispatchView`,
  `BindingChangeEvent`, `BindingChangeHandler`, `MonitorKey`, `MonitorValue`,
  `MonitorOptions`, `MonitorFields`, `ButtonOptions`, `NoteOptions`,
  `ThemePreferencesOptions`, `PresenceOptions`, `FieldLayoutOptions`.

```ts
import type { FacadeFolder } from "@jolly-pixel/ui";

function bindLighting(
  folder: FacadeFolder
): void {
  folder.addBinding(lighting, "intensity", { min: 0, max: 4 });
}
```
