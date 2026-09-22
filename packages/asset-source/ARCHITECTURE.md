# Asset source architecture

`AssetSource` is the byte-storage boundary used by the asset backend and other
callers. An asset is addressed by a root-relative POSIX path. The caller chooses
an adapter; this package does not keep a catalog or an edit history.

## Workspace map

```mermaid
flowchart TB
    Caller["Asset backend or other caller"]
    Contract["AssetSource<br/>byte storage contract"]
    FS["FilesystemAssetSource"]
    Memory["MemoryAssetSource"]
    IDB["IndexedDbAssetSource"]

    Caller --> Contract
    Contract --> FS
    Contract --> Memory
    Contract --> IDB
```

The contract has six required operations. `isIgnored` and `watch` are optional;
the filesystem adapter supplies both. The HTTP handler accepts any
`AssetSource`, so serving assets does not require filesystem storage.

| Adapter | Backing store | Lifetime | Listing and change signals |
|---|---|---|---|
| `FilesystemAssetSource` | Files below a local root | Persists on disk | Sorted walk; optional `watch()` reports paths |
| `MemoryAssetSource` | A `Map` owned by one instance | Until the instance is discarded | Sorted keys; no watcher |
| `IndexedDbAssetSource` | One IndexedDB `files` object store | Persists across page reloads | Keys from the store; no watcher |

The browser-safe `@jolly-pixel/asset-source/core` entry exports the contract,
memory adapter, path helpers and JSON helpers. The main entry also exports the
filesystem adapter and HTTP handler. IndexedDB has its own
`@jolly-pixel/asset-source/indexeddb` entry.

## Path and storage lifecycle

```mermaid
flowchart TB
    Input["Caller path"] --> Normalize["Normalize separators and dot segments"]
    Normalize --> Validate{"Relative file path<br/>inside root?"}
    Validate -->|"no"| Reject["AssetPathEscapeError"]
    Validate -->|"yes"| Adapter["Adapter operation"]
    Adapter -->|"filesystem"| Contain["Resolve real paths<br/>check symlink containment"]
    Contain -->|"escape"| Reject
    Contain -->|"contained"| Disk["Read or change bytes"]
    Adapter -->|"memory / IndexedDB"| Key["Use normalized path as key"]
```

`safeAssetPath` converts backslashes to `/`, collapses inner `.` and `..`
segments, and rejects empty, absolute, directory and escaping paths.
`normalizeAssetPath` throws `AssetPathEscapeError` on rejection. Direct
filesystem reads, existence checks, writes and deletes also resolve links
before access, so a symlink or junction cannot redirect them outside the
root. `resolve(path)` only performs lexical path resolution; it does not make
that filesystem check.

```mermaid
stateDiagram-v2
    [*] --> Missing
    Missing --> Present: write or successful writeIfAbsent
    Present --> Present: write replaces bytes
    Present --> Present: writeIfAbsent returns false
    Present --> Missing: delete
    Missing --> Missing: delete
```

`read` rejects when an asset is missing, while `exists` observes whether the
path is occupied at that moment. `writeIfAbsent` is the operation for creating
without replacing an occupied path. Filesystem writes use `AtomicFile`; the
memory adapter copies input and output byte arrays, and IndexedDB writes copy
their inputs before a transaction completes.

## Filesystem storage and changes

```mermaid
sequenceDiagram
    participant Caller
    participant Source as FilesystemAssetSource
    participant Paths as FilesystemPathResolver
    participant Disk as Filesystem root
    participant Watcher as FilesystemAssetWatcher

    Caller->>Source: write(path, bytes)
    Source->>Paths: contained(path)
    Paths-->>Source: path inside real root
    Source->>Disk: atomic write
    Source-->>Caller: complete

    Caller->>Source: list()
    Source->>Disk: walk files
    Disk-->>Source: root-relative paths
    Source-->>Caller: sorted paths after filtering

    Caller->>Source: watch(onChange)
    Source->>Watcher: watch root
    Disk-->>Watcher: add, change, or unlink
    Watcher-->>Caller: onChange(root-relative path)
    Caller->>Source: read or list to observe current state
```

`list()` skips ignored paths and temporary files from atomic writes. The
filesystem ignore matcher includes `.jollypixel/**`, `.git/**`,
`node_modules/**` and `dist/**`, plus caller-supplied globs. Ignoring affects
listing and watching; direct storage operations can still use those paths.
The watcher reports existing files on startup and provides a path without an
event kind. Its returned stop function closes the watcher.

Memory and IndexedDB also omit `.jollypixel/` state paths from `list()`, while
leaving them available to direct operations. Neither adapter emits changes.

## In-memory storage

```mermaid
flowchart TB
    Caller["Caller"] --> Source["MemoryAssetSource"]
    Source -->|"read · write · delete"| Files[("Instance-owned Map<br/>path → copied bytes")]
    Files -->|"keys"| List["list()<br/>hide state paths · sort"]
    List --> Caller
```

Each `MemoryAssetSource` owns its map. Construction and writes copy the input
bytes; reads return a copy. Its contents disappear with the instance, and it
has no `watch()` implementation.

## IndexedDB storage

```mermaid
flowchart TB
    Caller["Browser caller"] -->|"open(name)"| Source["IndexedDbAssetSource"]
    Source -->|"readonly or readwrite transaction"| Files[("IndexedDB<br/>files object store")]
    Files -->|"result after transaction completes"| Source
    Source -->|"close()"| Closed["Connection closed"]
```

The object store uses normalized asset paths as keys. `open()` creates it when
the database is first opened; later opens of the same database name see the
stored assets. `close()` releases a connection, while `destroy()` deletes the
database after its connections close. This adapter has no `watch()`
implementation.

## HTTP read path

```mermaid
sequenceDiagram
    participant Client as HTTP client
    participant Handler as Asset static handler
    participant Paths as Path helpers
    participant Source as AssetSource

    Client->>Handler: GET or HEAD under asset prefix
    Handler->>Paths: decode and validate request path
    Paths-->>Handler: root-relative path
    Handler->>Handler: hide state and ignored paths
    Handler->>Source: read(path)
    Source-->>Handler: bytes
    Handler-->>Client: 200, content type and length
```

Requests outside the configured prefix pass to `next()`. Under the prefix,
only `GET` and `HEAD` are served; `HEAD` returns the same headers without the
body. The handler strips query and fragment text, decodes the path once, then
validates it. State paths and paths hidden by `source.isIgnored` return `404`.
Missing assets and directory targets return `404`. Invalid encodings and
control characters return `400`; absolute or escaping paths return `403`.
Other read failures return `500`.

Details: [storage contract](./docs/AssetSource.md),
[filesystem](./docs/Filesystem.md), [memory](./docs/Memory.md),
[IndexedDB](./docs/IndexedDb.md), [HTTP](./docs/Http.md), and
[path utilities](./docs/Utilities.md).
