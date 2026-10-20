# Editor fixture

`@jolly-pixel/e2e/editor` creates each test's documents through the catalog,
then opens the editor on them.

## `editorFixture(options)`

Returns a `test` whose auto fixture creates the test's documents and opens the
editor on them.

```ts
// Import Third-party Dependencies
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";

export { expect } from "@playwright/test";

export const test = editorFixture({
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
| `create(catalog)` | creates the documents; returns a record with the `id` to open |
| `editor` | default [`OpenEditorOptions`](./navigation.md#openeditoroptions) without `target` |

| Fixture | |
|---|---|
| `target` | auto; the record `create` returned, typed from it |
| `editor` | option; replace it per file with `test.use({ editor })`; `username` defaults to `"E2E"` when it is unset |
| `role` | option, `"member"` by default; see [Roles](#roles) |
| `access` | the [`ContextAccess`](../roles.md#contextaccess) of the test's browser context, granted `role` before the editor opens |
| `peer` | a `Page` in a second browser context on the same target, as `"Peer"`; the context closes on teardown |

A test that asserts what happens after the peer leaves closes it itself with
`await peer.context().close()`.

## Roles

Every test's browser context is granted `role` before the editor opens, under
a subject unique to the test, so parallel tests never revoke each other.
`access.become(role)` switches it live. Start from another role with
`test.use({ role })`. The `peer` context gets no grant and authenticates as
its connection.

```ts
test("a spectator only views", async({ access }) => {
  await access.become("spectator");
});
```

## Catalog

- `withCatalog(baseURL, fn)`: opens a network client on the sync server of the
  dev server at `baseURL` and a `CatalogClient`, awaits `ready`, runs
  `fn(catalog)`, then disposes both.
- `e2eFolder()`: `e2e/<uuid>`, a fresh folder for one test's documents.
