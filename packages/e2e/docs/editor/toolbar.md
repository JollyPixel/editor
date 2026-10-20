# Editor toolbar

`EditorToolbar` from `@jolly-pixel/e2e/editor` drives the
`<jolly-editor-toolbar>` that `@jolly-pixel/editor.host` renders above an
editor's viewport.

```ts
import {
  EditorToolbar,
  followEditor
} from "@jolly-pixel/e2e/editor";

const toolbar = new EditorToolbar(page);
await toolbar.saveVersion("v1", "First pass");
await toolbar.viewVersion(/v1 ·/);
await followEditor(page, /tag=v1/);
```

## Locators

- `root`: the toolbar element.
- `assets` and `versions`: the comboboxes of the Asset and Version selects.
- `saveButton`: Save version, shown on the current version.
- `readOnly`: the Read-only text next to the lock icon, shown while the page
  shows a tag.
- `restoreButton` and `deleteButton`: the Restore this version and Delete this
  version icon buttons, shown next to Read-only.
- `error`: the error of the last failed action.

## Actions

- `saveVersion(name, message?)`: clicks Save version, fills the New tag
  dialog and waits for it to close.
- `openAsset(label)`: picks the first Asset entry whose text matches `label`,
  the asset path without its extension.
- `viewVersion(label)`: picks the first Version entry whose text matches
  `label`. A tag entry reads `name · date · message`.
- `confirm(heading, button)`: clicks `button` in the open dialog whose banner
  shows `heading`, such as `confirm("Restore tag", "Restore")`.

Picking an asset or a version switches the editor in place; wait for it with
[`followEditor(page, url)`](./navigation.md#navigation).
