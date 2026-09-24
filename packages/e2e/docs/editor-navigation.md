# Editor navigation

`@jolly-pixel/e2e/editor` relies on the editor host contracts: `?target=`,
`?username=`, `?max-fps=` and `?debug=` query parameters, `data-editor-state` on `<html>`,
and `window.jollyEditor` in dev builds.

## Navigation

- `openEditor(page, options?)`: navigates, then waits until the editor is ready.
- `waitForEditor(page)`: waits for `data-editor-state="ready"`; throws on
  `"failed"`. Use it after `page.reload()`.
- `editorPath(options?)`: the path `openEditor` navigates to.

### `OpenEditorOptions`

| Option | Query |
|---|---|
| `target` | `target=` |
| `username` | `username=` |
| `maxFps` | `max-fps=` |
| `debug` | `debug=`, the boot trace namespaces such as `host.*`; `""` logs every namespace |
| `query` | extra entries, written last; `""` gives a bare flag such as `offline=` |

## Frames

- `nextFrames(page, count = 2)`: resolves after `count` runtime updates. It
  waits on the runtime, not `requestAnimationFrame`: with a frame cap most
  animation frames render nothing. Throws when the editor runs without a
  runtime.
- `editorHandle<THandle>(page)`: `JSHandle` on `window.jollyEditor`. The default
  type only knows `runtime.frames()`; pass the host's `EditorHandle` or an
  editor type for more.
