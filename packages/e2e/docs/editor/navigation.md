# Editor navigation

`@jolly-pixel/e2e/editor` relies on the editor host contracts: `?target=`,
`?username=`, `?max-fps=` and `?debug=` query parameters, `data-editor-state` on `<html>`,
and `window.jollyEditor` in dev builds.

## Navigation

Each navigation helper ends by waiting for `data-editor-state="ready"` and
throws when the editor reports `"failed"`.

- `openEditor(page, options?)`: navigates to `editorPath(options)`.
- `reloadEditor(page, reload?)`: listens for the next `load` event, then runs
  `reload`, so an early load is never missed. `reload` defaults to
  `page.reload()`; pass the action when the page reloads itself, such as a
  click on Reset offline data.
- `followEditor(page, url)`: waits until the URL matches `url` (a string, a
  `RegExp` or a predicate on `URL`), after an archive import or a version
  switch. The editor may switch in place without a page load.
- `waitForEditor(page)`: only the readiness wait, for a page that navigated
  some other way, such as `page.goto(inviteUrl)`.
- `editorPath(options?)`: the path `openEditor` navigates to.

### `OpenEditorOptions`

| Option | Query |
|---|---|
| `target` | `target=` |
| `username` | `username=` |
| `maxFps` | `max-fps=` |
| `debug` | `debug=`, the boot trace namespaces such as `host.*`; `""` logs every namespace |
| `query` | extra entries, written last; `""` gives a bare flag such as `offline=` |
