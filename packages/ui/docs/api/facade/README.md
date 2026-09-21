# Facade API

The facade is exported from `@jolly-pixel/ui`. It creates the same custom
elements available to Lit templates and plain HTML.

```ts
import {
  DockFacade,
  Pane
} from "@jolly-pixel/ui";
```

- [`Pane`](./pane.md) is the facade entry point.
- [`DockFacade`](./dock.md) wraps an authored `jolly-dock`.
- [Folder builders](./folder.md) group facade children.
- [Bindings](./binding.md) edit object properties.
- [Monitors](./monitor.md) display object properties.
- [Buttons and separators](./actions.md) add actions and visual divisions.
- [Notes, elements and theme preferences](./content.md) add content the facade
  does not bind.
- [Presence](./presence.md) displays peer snapshots.

## Shared builder surface

Every builder returned by the facade implements `Disposable`:

```ts
interface Disposable {
  dispose(): void;
}
```

Builders also expose their underlying `element` and mutable `hidden` and
`disabled` properties, shared through one `FacadeItem` base. `disabled` writes
the native property on buttons and bound fields, and toggles the `disabled`
attribute on every other builder. `Pane` and folder builders add `refresh()`
and `disposeAll()` because they own child builders.

Disposing a builder detaches it from the container that created it, so a
container never keeps a builder it no longer owns.

## Naming the builders

Every builder type is exported, under a `Facade` prefix where the element of
the same name already holds the plain one:

| Returned by | Type |
|---|---|
| `addFolder()` | `FacadeFolder` |
| `addBinding()` | `FacadeBinding<TObject, TKey>` |
| `addMonitor()` | `FacadeMonitor<TObject, TKey>` |
| `addButton()` | `FacadeButton` |
| `addSeparator()` | `FacadeSeparator` |
| `addNote()` | `FacadeNote` |
| `addThemePreferences()` | `FacadeThemePreferences` |
| `addElement()` | `FacadeElement<TElement>` |
| `addPresence()` | `Presence` |

```ts
import type { FacadeFolder } from "@jolly-pixel/ui";

function bindLighting(
  folder: FacadeFolder
): void {
  folder.addBinding(lighting, "intensity", { min: 0, max: 4 });
}
```

`FacadeItem` and `FacadeContainer` are exported as types only. `FacadeItem` is
the shell every builder shares, and `FacadeContainer` is the surface `Pane` and
`FacadeFolder` have in common, for code that takes either.

The root entry point also exports the option and callback types `PaneOptions`,
`FolderOptions`, `BindingOptions`, `BindingChangeEvent`,
`BindingChangeHandler`, `MonitorKey`, `MonitorOptions`, `MonitorFields`,
`ButtonOptions`, and `PresenceOptions`.

For an assembled workflow, read [Using the facade](../../guides/using-the-facade.md).

