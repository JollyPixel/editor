# Folder facade

`pane.addFolder()` and `folder.addFolder()` create `jolly-folder` elements.

```ts
interface FolderOptions {
  title?: string;
  expanded?: boolean;
}

const folder = pane.addFolder({
  title: "Transform",
  expanded: true
});
```

`title` defaults to `""` and maps to the element's `label`. `expanded`
defaults to `true` and maps to `open`.

## Methods

Folders can add folders, bindings, monitors, buttons, separators, notes, theme
preferences, plain elements, and presence views. Their method signatures match
the [`Pane` methods](./pane.md#methods).

`refresh()` re-reads the folder's direct bindings and monitors. It also calls
`refresh()` on nested folders created through the facade.

`disposeAll()` removes direct child builders and starts a new empty child
list. Elements appended directly to `folder.element` are not tracked and remain
in the folder; `addElement()` adds one that is. Disposing a builder on its own
also detaches it, so the folder stops holding it.

```ts
const state = { visible: true };
const folder = pane.addFolder({ title: "Layer" });
folder.addBinding(state, "visible");

state.visible = false;
folder.refresh();
```

The builder also exposes `element`, `hidden`, `disabled`, and `dispose()`.

