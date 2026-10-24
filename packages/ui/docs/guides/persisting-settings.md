# Persisting settings

Remember folder states, dock sizes and tool options across reloads, through
one `StorageAdapter` port that tests replace with memory.

## 1. Let elements remember their state

```html
<jolly-dock-layout storage-key="voxel-editor">
  <jolly-dock key="right" side="right">
    <jolly-pane key="inspector" heading="Inspector">
      <jolly-folder key="shadows" label="Shadows" storage-key="voxel-editor:shadows">
      </jolly-folder>
    </jolly-pane>
  </jolly-dock>
</jolly-dock-layout>
```

- Elements with a `storage-key` store under `<storage-key>:<name>`.
- The dock layout stores the arrangement, sizes and floating windows. A
  folder stores whether it is open. A pane stores its folder order.
- Elements without a `storage` property share one `LocalStorageAdapter` for
  the page.
- Prefix every key with the editor name, so two editors on one origin do not
  read each other's state.

## 2. Store application settings

Give a settings store the same port. Default it to memory, and inject
`localStorage` at boot:

```ts
import { MemoryStorageAdapter, type StorageAdapter } from "@jolly-pixel/ui";

const kStorageKey = "terrain:sculpt";

export class SculptSettings {
  #storage: StorageAdapter;
  #options: Readonly<SculptOptions>;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    this.#storage = storage;
    this.#options = parseOptions(storage.get(kStorageKey));
  }

  get options(): Readonly<SculptOptions> {
    return this.#options;
  }

  update(
    changes: Partial<SculptOptions>
  ): void {
    this.#options = parseOptions(JSON.stringify({ ...this.#options, ...changes }));
    this.#storage.set(kStorageKey, JSON.stringify(this.#options));
  }
}
```

```ts
import { LocalStorageAdapter } from "@jolly-pixel/ui";

const settings = new SculptSettings(new LocalStorageAdapter());
```

- `parseOptions` turns whatever is stored, or `null`, into valid options:
  defaults for missing keys, numbers clamped, unknown choices dropped. A value
  written by an older version then never breaks the editor.
- Emit a change event from `update`, so panels can subscribe to the store.
  See [Keeping an element in sync](./syncing-with-a-model.md).
- Fields bound to the store read through it with `FieldBinding`, and write
  only on commit. See [Preview and commit](./preview-and-commit.md).

## 3. Scope storage to a project

Implement the port to put every key under a prefix:

```ts
class ProjectStorage implements StorageAdapter {
  #inner: StorageAdapter;
  #project: string;

  constructor(
    inner: StorageAdapter,
    project: string
  ) {
    this.#inner = inner;
    this.#project = project;
  }

  get(
    key: string
  ): string | null {
    return this.#inner.get(`${this.#project}:${key}`);
  }

  set(
    key: string,
    value: string
  ): void {
    this.#inner.set(`${this.#project}:${key}`, value);
  }
}

const storage = new ProjectStorage(new LocalStorageAdapter(), projectId);

html`
  <jolly-dock-layout storage-key="voxel-editor" .storage=${storage}>
    <jolly-dock key="right" side="right">
      <jolly-pane key="inspector" heading="Inspector" .storage=${storage}>
        <jolly-folder key="shadows" label="Shadows" .storage=${storage}></jolly-folder>
      </jolly-pane>
    </jolly-dock>
  </jolly-dock-layout>
`;
```

Each element reads its own `storage`, so pass the adapter to panes and folders
as well. Inside a dock layout, the layout stores dock sizes itself.

`storage` is a property, with no attribute. Set it before the element first
renders, as a Lit `.storage=${storage}` binding does: the dock layout reads
the stored arrangement once, on its first update.

## 4. Test without a browser

```ts
const storage = new MemoryStorageAdapter();
storage.set("terrain:sculpt", JSON.stringify({ size: 999 }));

const settings = new SculptSettings(storage);
assert.equal(settings.options.size, BRUSH_SIZE.max);
```

`MemoryStorageAdapter` keeps values for the lifetime of the instance, so each
test starts from its own state.

## 5. When storage fails

- `LocalStorageAdapter` falls back to memory after the first failed access,
  such as a full quota or blocked site data, and stays there.
- `persistent` tells whether writes still reach `localStorage`. Show it when
  losing settings at reload would surprise the user.
- `new LocalStorageAdapter({ resolve: () => sessionStorage })` keeps state for
  the tab only.

## 6. Ask once, then remember

`resolveStoredPrompt` returns a stored answer, or prompts for it once:

```ts
import { resolveStoredPrompt } from "@jolly-pixel/ui/elements/dialog";

const author = await resolveStoredPrompt({
  title: "Your name",
  label: "Name shown to collaborators",
  storageKey: "editor:author",
  fallbackValue: "Anonymous"
});
```

An empty answer stores `fallbackValue`, so the prompt does not come back on
every load.
