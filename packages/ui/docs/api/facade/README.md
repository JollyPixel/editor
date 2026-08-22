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
- [Presence](./presence.md) displays peer snapshots.

## Shared builder surface

Every builder returned by the facade implements `Disposable`:

```ts
interface Disposable {
  dispose(): void;
}
```

Builders also expose their underlying `element` and mutable `hidden` and
`disabled` properties. `Pane` and folder builders add `refresh()` and
`disposeAll()` because they own child builders.

The root entry point exports the option and callback types `PaneOptions`,
`FolderOptions`, `BindingOptions`, `BindingChangeEvent`,
`BindingChangeHandler`, `MonitorKey`, `MonitorOptions`, `MonitorFields`,
`ButtonOptions`, and `PresenceOptions`.

For an assembled workflow, read [Using the facade](../../guides/using-the-facade.md).

