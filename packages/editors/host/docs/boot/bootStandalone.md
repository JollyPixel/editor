# bootStandalone

Entry point of an editor page. It reads the launch, opens the session, mounts
the [editor definition](./EditorDefinition.md), and falls back to offline mode
when the asset server cannot be reached.

```ts
void bootStandalone(VoxelMapEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "voxelMapEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const [
      { createDefaultSeed },
      { default: createHandlers }
    ] = await Promise.all([
      import("./boot/defaultSeed.ts"),
      import("virtual:jolly-pixel/handlers")
    ]);

    return { ...createDefaultSeed(), handlers: createHandlers() };
  }
});
```

## Options

```ts
interface BootStandaloneOptions {
  offline: () => OfflineProject | Promise<OfflineProject>;
  forceOffline?: boolean;
  dev?: boolean;
  debugHandle?: string;
}

interface OfflineProject {
  handlers: AssetKindHandler[];
  seed?: AssetSeedMap | (() => AssetSeedMap | Promise<AssetSeedMap>);
}
```

- `offline` runs only in the tab that owns the offline data, so import its
  modules dynamically.
- `forceOffline` skips the server. Pass `import.meta.env.MODE === "static"`
  for a static build.
- `dev` exposes the mounted handle as `window.jollyEditor`, and as
  `globalThis[debugHandle]` when `debugHandle` is set. It also stores the
  `?username=` parameter so the username prompt is skipped.

## Startup

The page picks the first case that applies:

1. A `#peer=<host>.<token>` fragment joins another tab of the same browser
   profile as a guest, with no socket.
2. An injected launch with a `credential` (a studio `/view/<token>` share
   link) opens the target read-only, with no username prompt and no offline
   fallback.
3. `forceOffline` or the `?offline` [query parameter](../params/QueryParams.md#host-parameters)
   mounts offline at once.
4. Otherwise the page mounts online. When the catalog does not answer
   (`CatalogUnavailableError`) or no launch is found (`LaunchNotFoundError`),
   a dialog offers Retry or Work offline. Any other error is rethrown.

## Offline data

- Offline assets live in the `jolly-offline:<name>` IndexedDB database. The
  name is the `?offline=<name>` value, or `definition.accepts` without one.
- One tab owns the data. Other tabs of the same origin use its catalog and
  rooms.
- `seed` is applied only while the storage holds no asset, so a deleted seed
  asset does not come back. Give seeded assets random ids, or every user's
  archives collide on import.

## Page state

`data-editor-state` (`EDITOR_STATE_ATTRIBUTE`) on `document.documentElement`
is `booting`, `ready`, `switching` or `failed`. `ready` waits for
`handle.ready` and, for an editor with a runtime, the first compiled frame.

```ts
await page.waitForFunction(
  () => document.documentElement.dataset.editorState === "ready"
);
```

## Switching asset or tag

The toolbar opens another asset or version without reloading the page:

- The host waits for the server to acknowledge pending changes, and keeps the
  current editor when that takes more than 10 seconds.
- It disposes the handle, then calls `mount` again with a new session on the
  same connection and the same `EditorRuntime`.
- State that `mount` created, such as the selected brush, starts over.

## Debug logging

Boot steps go to a `HostLogger`. Nothing is logged until namespaces are
enabled, as comma-separated globs:

- `?debug=host.*,editor.*` in the URL; a bare `?debug` enables everything.
- `localStorage.setItem("jolly-pixel:debug", "*")` for pages framed by the
  studio. The query parameter wins.

`host.boot`, `host.launch`, `host.session`, `host.switch` and `host.console`
trace the host. `editor` is `context.logger`, and `editor.runtime` the logger
passed to `createRuntime`.
