# Editor fixture

`@jolly-pixel/e2e/editor` creates each test's documents through the catalog,
then opens the editor on them.

## `editorFixture(options)`

Returns a `test` whose auto fixture creates the test's documents and opens the
editor on them.

```ts
// Import Third-party Dependencies
import {
  PORTS,
  socketUrl
} from "@jolly-pixel/e2e";
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";

export { expect } from "@playwright/test";

export const test = editorFixture({
  socketUrl: socketUrl(PORTS.voxelModel),
  editor: {
    maxFps: 5
  },
  async create(catalog) {
    const id = await catalog.create(
      `${e2eFolder()}/model.voxelmodel.json`,
      encodeModelDocument(),
      { kind: VOXEL_MODEL_KIND }
    );

    return { id };
  }
});
```

| Option | |
|---|---|
| `socketUrl` | sync server the catalog client connects to |
| `create(catalog)` | creates the documents; returns a record with the `id` to open |
| `editor` | default [`OpenEditorOptions`](./editor-navigation.md#openeditoroptions); `username` defaults to `"E2E"` |

| Fixture | |
|---|---|
| `target` | auto; the record `create` returned, typed from it |
| `editor` | option; replace it per file with `test.use({ editor })` |
| `peer` | a `Page` in a second browser context on the same target, as `"Peer"`; the context closes on teardown |

A test that asserts what happens after the peer leaves closes it itself with
`await peer.context().close()`.

## Catalog

- `withCatalog(socketUrl, fn)`: opens a network client and a `CatalogClient`,
  awaits `ready`, runs `fn(catalog)`, then disposes both.
- `e2eFolder()`: `e2e/<uuid>`, a fresh folder for one test's documents.
