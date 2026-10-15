# Folder facade

`addFolder(options?)` creates a `jolly-folder`. A folder is a
[container](./README.md#containers), with the same `add*()` methods as the
pane.

```ts
interface FolderOptions {
  title?: string; // the folder label
  expanded?: boolean; // the folder open state, default true
}

const state = { visible: true };
const folder = pane.addFolder({ title: "Layer" });
folder.addBinding(state, "visible");

state.visible = false;
folder.refresh();
```
