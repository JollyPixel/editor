# Architecture

`@jolly-pixel/editor.host` is the code every editor page shares. It finds the
asset to open, opens a session on it and mounts the editor. Terms are defined
in the [glossary](./GLOSSARY.md).

## Map

```mermaid
flowchart TB
    Page["mountStandalone(Editor)"] --> Launch["EditorLaunch"]
    Launch --> Session["EditorSession"]
    Session --> Leases["AssetLeases"]
    Session -->|"mount(context)"| Editor["Editor class"]
    Editor -.-> Runtime["EditorRuntime"]
```

- `launch/`: where the target comes from, and the `ShellChannel` to a parent frame.
- `session/`: the connection, the session, toolbar sources and archives.
- `lease/`: one shared room, and at most one document, per asset.
- `editor/`: `mountStandalone`, `bootStandalone`, `EditorMount`, `Placement`.
- `state/`: the page state (`data-editor-state`) and its loading bar.
- `runtime/`: the 3D runtime wrapper and `PeerFrustums`.
- `workspace/`: offline and shared-tab connections, behind the `./offline` entry.

## Who owns what

```mermaid
flowchart TB
    Host["host"] --> Session["session + connection"]
    Host --> Runtime["runtime"]
    Editor["editor handle"] --> Scene["scene, panels"]
    Editor --> Target["target document"]
```

- The host keeps the session, the connection and the runtime for the page's lifetime.
- The editor releases only what `mount` built, in `dispose()`.
- `Editor.createRuntime(logger)` is optional; editors without a 3D view skip it.

## Boot

```mermaid
flowchart TB
    Start["mountStandalone"] --> Runtime["createRuntime"]
    Start --> Launch["read launch"]
    Launch --> Session["open session"]
    Session --> Mount["Editor.mount(context)"]
    Runtime --> Mount
    Mount --> Ready["await handle.ready"]
```

- The runtime is created while the launch is read; `mount` awaits it.
- With a `connect` option and a `?target=` in the URL, the session opens before
  the launch answers. It is kept only if the launch names the same view.
- Every dependency document is synced before `mount`. The target room is only reserved.
- Once ready, the page gets `data-editor-state="ready"` and, in dev, `window.jollyEditor`.

## Finding the target

```mermaid
flowchart TB
    Read["EditorLaunch.read"] --> Frame{"inside a frame?"}
    Frame -->|"yes"| Parent["jolly-launch from the parent"]
    Frame -->|"no"| Sources["sources in order"]
    Parent -->|"timeout"| Sources
    Sources -->|"none answers"| Missing["LaunchNotFoundError"]
```

- The first source that answers wins. Outside a frame there is no wait.
- The parent has 1000 ms, from an allowed origin (the page's own by default).
- Default sources: `?target=`, then the injected JSON element.
- `mountStandalone({ sources })` replaces the defaults; the parent is always asked first.

## Inside a shell

```mermaid
flowchart TB
    Shell["parent shell"] -->|"jolly-launch, jolly-appearance"| Page["editor page"]
    Page -->|"jolly-shell commands"| Shell
    Page -->|"console namespaces"| Port["console port"]
```

- Only a launch answered by the parent carries a `ShellChannel` (`context.shell`).
- The page mounts no console of its own and forwards Ctrl+K as `toggle-console`.
- It posts `unsaved` when its documents gain or lose unacknowledged changes.
- It posts `editor-state` on every page state change (`PageState`).
- It posts `session-refused` and reconnects after `jolly-session-renewed`.
- Messages and ports: [ShellChannel](./docs/launch/ShellChannel.md).

## Placement

```mermaid
flowchart TB
    Launch["EditorLaunch"] --> Placement["Placement"]
    Placement --> Console["console: own or forwarded"]
    Placement --> History["history: push or replace"]
    Placement --> Guard["unsaved: beforeunload or shell"]
    Placement --> Toolbar["toolbar sources"]
```

- Placement reads the launch, never the session: an early session cannot tell
  a shell or share-link launch from a plain page.
- `targets` exist only outside a shell, `tags` only on a server connection, and neither for a share link.
- A workspace-backed session remembers its target for the next offline launch.

## Target and dependencies

```mermaid
flowchart TB
    Session["EditorSession"] --> Target["target"]
    Session --> Closure["catalog closure"]
    Target -->|"kind registered"| Doc["session document"]
    Target -->|"no kind"| Room["room only"]
    Closure -->|"kind in Editor.kinds"| Lease["dependency lease"]
```

- A room-only target is joined and synced by the editor itself.
- A dependency is leased only when its reference kind matches its record kind.
- `dependencies()` and `dependency(id)` return frozen views without `release()`.
- A panel that needs a longer lifetime opens its own lease through `session.assets`.

## Following the catalog

```mermaid
flowchart TB
    Change["catalog change"] --> Diff["diff wanted leases"]
    Diff --> Open["open new leases"]
    Open --> Release["release removed ones"]
    Release --> Events["dependency-removed, dependency-added"]
```

- Only the boot waits for dependency documents. A lease from `dependency-added` may still be syncing.
- After awaiting it, check `session.dependency(id)` still returns that view.
- If an open throws, the pass is rolled back and the previous set stays.

## Lease lifecycle

```mermaid
stateDiagram-v2
    direction TB
    [*] --> Open: first open() or openRoom()
    Open --> Open: holders + 1 or - 1
    Open --> Closed: last release() or dispose()
    Closed --> [*]
```

- Every holder shares one room and at most one document.
- `open(kind)` joins on first open; `openRoom` does not join.
- Opening with another document kind, or with a kind after `openRoom`, throws `AssetDocumentConflictError`.
- Kinds compare by identity: reuse the objects from `Editor.kinds`.
- `release()` is idempotent per holder. `AssetLeases.dispose()` closes everything.

## Switching target or tag

```mermaid
flowchart TB
    Navigate["navigate(target, tag)"] --> Settle["settle pending changes"]
    Settle --> Next["open next session"]
    Next --> Remount["dispose handle, mount"]
    Remount --> Drop["dispose old session"]
```

- The page, runtime, client and catalog stay. Leases both sessions use are shared.
- The old session is disposed last, so the old scene keeps its documents until replaced.
- The boot is the first switch, through the same `EditorMount`.
- One switch at a time; only the latest waiting request runs and writes the URL.
- A tag view puts only the target on its read-only tag room.
- A failed remount reloads the page on the requested launch.

## Archives and workspace

```mermaid
flowchart TB
    Editor["editor"] --> Archive["session.archive"]
    Archive --> Catalog["catalog commands"]
    Workspace["session.workspace"] -->|"persistent?"| Archive
```

- `export`, `plan` and `import` go through the catalog, online or offline.
- A memory workspace cannot import: `archive.canImport` is `false`.
- `session.workspace` is `null` on the default server connection.
- API: [archives](./docs/session/Archives.md).

## Offline

```mermaid
flowchart TB
    Boot["bootStandalone"] -->|"?offline or no server"| Open["open workspace"]
    Open --> Owner["owner tab: OfflineWorkspace"]
    Open --> Remote["other tab: RemoteWorkspace"]
    Owner --> Connect["connect()"]
    Remote --> Connect
    Connect --> Mount["same mount path"]
```

- The workspace runs the asset back-end in the page, so session and leases work unchanged.
- `./offline` is a separate entry, loaded only when needed.
- With IndexedDB, one tab holds the lock; other tabs reach it over a BroadcastChannel.
- Only the owner tab loads the back-end and the editor's handlers and seed.
- Without Web Locks the shared opener falls back to memory storage.
- Storage, seeds and reset: [bootStandalone](./docs/editor/bootStandalone.md#offline-workspace).

## Failure and teardown

```mermaid
flowchart TB
    Launch["no launch"] --> Nothing["nothing to release"]
    Connect["catalog or target fails"] --> Client["connection disposed"]
    Mount["sync or mount fails"] --> All["session and connection disposed"]
    Leave["pagehide, persisted"] --> Everything["handle, session, connection, runtime"]
```

- Session disposal releases its leases.
- Connection disposal closes remaining leases, the catalog and the network client.
- A page restored from the back-forward cache reloads.

## Runtime keyboard

```mermaid
flowchart TB
    Key["key event"] --> Layer{"dialog or popover?"}
    Layer -->|"yes"| Ui["layer keeps it"]
    Layer -->|"no"| Hover{"over a 2D panel?"}
    Hover -->|"yes"| Panel["panel shortcuts"]
    Hover -->|"no"| Scene["scene shortcuts"]
```

- `EditorRuntime.create` installs the input-layer guard.
- The hover branch exists only after `suspendKeyboardOnHover`; overlapping bindings release last-out.
- `PeerFrustums` is an actor component editors add for peer cameras.

API: [mountStandalone](./docs/editor/mountStandalone.md),
[bootStandalone](./docs/editor/bootStandalone.md),
[EditorLaunch](./docs/launch/EditorLaunch.md),
[EditorSession](./docs/session/EditorSession.md),
[EditorToolbar](./docs/session/EditorToolbar.md),
[AssetLeases](./docs/lease/AssetLeases.md),
[EditorRuntime](./docs/runtime/EditorRuntime.md),
[QueryParams](./docs/params/QueryParams.md).
