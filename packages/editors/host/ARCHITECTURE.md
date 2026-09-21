# Architecture

`@jolly-pixel/editor.host` is the part every editor shares: it finds the asset
to open, connects to the asset server, keeps the asset's dependencies loaded
and hands the result to the editor. The words used here are defined in the
[glossary](./GLOSSARY.md).

## System map

```mermaid
flowchart TB
  subgraph Page
    direction TB
    Frame["parent frame message"]
    Query["?target= query"]
    Injected["injected JSON element"]
  end

  subgraph Host["editor.host"]
    direction TB
    Mount["mountStandalone"]
    Launch["EditorLaunch<br/>target id"]
    Session["EditorSession"]
    Leases["AssetLeases<br/>one room per asset"]
    Runtime["EditorRuntime"]
  end

  subgraph Editor["Editor class"]
    direction TB
    Definition["static accepts, identity, kinds"]
    MountFn["static mount(context)"]
    Handle["instance<br/>dispose()"]
  end

  subgraph Server["Asset server"]
    direction TB
    Catalog["catalog room"]
    Rooms["asset rooms"]
  end

  Frame --> Launch
  Query --> Launch
  Injected --> Launch
  Mount --> Launch
  Definition --> Mount
  Launch --> Session
  Session --> Leases
  Session <-->|"records, dependency edges"| Catalog
  Leases <-->|"join, leave"| Rooms
  Session -->|"context"| MountFn
  MountFn --> Runtime
  MountFn --> Handle
```

The host owns everything above `mount`. The editor owns its scene, its panels
and the model of the asset it edits.

## Boot

```mermaid
sequenceDiagram
  autonumber
  participant E as Editor class
  participant M as mountStandalone
  participant L as Launch sources
  participant S as EditorSession
  participant C as Catalog
  participant A as AssetLeases

  E->>M: mountStandalone(Editor)
  M->>L: read() in order
  L-->>M: EditorLaunch { target }
  M->>S: open({ launch, accepts, identity, kinds })
  S->>S: prompt username
  S->>C: connect, await ready
  S->>A: openRoom(accepts, target)
  A-->>S: target lease, room not joined
  loop each dependency with a known kind
    S->>A: open(kind, assetId)
    A-->>S: lease { model, ready }
  end
  S->>S: await every ready
  S-->>M: session
  M->>E: mount({ launch, session })
  E-->>M: handle
```

`mount` starts with every dependency model already synced. The target is the
exception: the session only reserves its room.

## Finding the target

```mermaid
flowchart TB
  Start["EditorLaunch.read(sources)"] --> Framed{"inside a frame?"}
  Framed -->|"no"| Query
  Framed -->|"yes"| Wait["wait 1000 ms for<br/>{ type: 'jolly-launch', target }<br/>from window.parent"]
  Wait -->|"received"| Found["EditorLaunch"]
  Wait -->|"timeout"| Query{"?target= present?"}
  Query -->|"yes"| Found
  Query -->|"no"| Element{"injected JSON element<br/>present and valid?"}
  Element -->|"yes"| Found
  Element -->|"no"| Missing["throw LaunchNotFoundError"]
```

The first source that answers wins. A page outside a frame skips the wait, so
a plain tab boots without the timeout. The injected element is written by the
asset workspace Vite plugin's `launch` option.

## Target and dependencies

```mermaid
flowchart TB
  Session["EditorSession"]

  subgraph TargetSide["Target: owned by the editor"]
    direction TB
    TargetLease["session.target<br/>record + room"]
    TargetModel["editor's own model"]
    Join["editor calls room.join()"]
    TargetLease --> TargetModel --> Join
  end

  subgraph DependencySide["Dependencies: owned by the session"]
    direction TB
    Closure["catalog closure of the target"]
    Filter{"kind listed in<br/>Editor.kinds?"}
    DepLease["lease<br/>record + room + model + ready"]
    Skipped["not leased"]
    Closure --> Filter
    Filter -->|"yes"| DepLease
    Filter -->|"no"| Skipped
  end

  Session --> TargetLease
  Session --> Closure
```

The session never builds the target model because each editor syncs its target
differently. It builds dependency models from the `AssetModelKind` objects in
`kinds`, and joins their rooms itself.

## Following the catalog

```mermaid
sequenceDiagram
  participant C as Catalog
  participant S as EditorSession
  participant A as AssetLeases
  participant E as Editor

  Note over C: a peer adds a dependency edge
  C->>S: "dependencies"
  S->>A: open(kind, assetId)
  S-->>E: "dependency-added" (lease)
  E->>E: await lease.ready

  Note over C: the edge is removed, or the record deleted
  C->>S: "dependencies" or "change"
  S->>A: lease.release()
  S-->>E: "dependency-removed" ({ id, kind })
```

Only the boot waits for `ready`. A lease announced by `dependency-added` may
still be syncing.

## Lease lifecycle

```mermaid
stateDiagram-v2
  direction TB
  [*] --> Open: first open() or openRoom()
  Open --> Open: another holder opens, holders + 1
  Open --> Open: release(), holders - 1
  Open --> Closed: last release()
  Open --> Closed: AssetLeases.dispose()
  Closed --> [*]

  note right of Open
    one room and at most one model,
    shared by every holder
  end note
  note right of Closed
    model disposed, room left
  end note
```

A panel that opens its own lease on a dependency keeps the model alive after
the session drops the edge. The entry remembers how it was first opened:

| First opened with | Then `openRoom` | Then `open(sameKind)` | Then `open(otherKind)` |
|---|---|---|---|
| `open(kind)` | shares | shares | `AssetModelConflictError` |
| `openRoom` | shares | `AssetModelConflictError` | `AssetModelConflictError` |

## Failure and teardown

```mermaid
flowchart TB
  Read["read launch"] -->|"no source answers"| E1["LaunchNotFoundError<br/>nothing to release"]
  Read --> Connect["connect catalog, lease target"]
  Connect -->|"unknown target or wrong kind"| E2["catalog disposed<br/>client destroyed"]
  Connect --> Ready["await dependency models"]
  Ready -->|"a model rejects ready"| E3["session disposed"]
  Ready --> MountStep["Editor.mount(context)"]
  MountStep -->|"throws"| E3
  MountStep --> Running["editor running"]
  Running -->|"handle.dispose()"| Dispose["editor calls session.dispose()"]
  Dispose --> Released["every lease closed<br/>catalog disposed<br/>client destroyed"]
```

After a successful `mount` the session belongs to the editor: the host never
disposes it again.

## Runtime keyboard

```mermaid
flowchart TB
  Key["key event"] --> Guard{"dialog or popover open?<br/>inputLayers guard"}
  Guard -->|"yes"| Ui["the open layer keeps the key"]
  Guard -->|"no"| Hover{"pointer over a<br/>2D canvas panel?"}
  Hover -->|"yes"| Panel["keyboard disabled<br/>panel shortcuts only"]
  Hover -->|"no"| Scene["runtime keyboard<br/>scene shortcuts"]
```

`EditorRuntime.create` installs the guard. The hover branch exists only after
the editor calls `suspendKeyboardOnHover`.

## Offline

```mermaid
flowchart TB
  Editor["editor entry<br/>?offline"] -->|"dynamic import"| Offline["OfflineWorkspace.open"]

  subgraph Page["Same page"]
    direction TB
    Offline --> Source["MemoryAssetSource<br/>seeded documents"]
    Offline --> Events["memory event store"]
    Source --> Backend["asset back-end"]
    Events --> Backend
    Backend --> Server["network Server<br/>catalog room, asset rooms"]
    Server <-->|"LoopbackTransport"| Client["network Client"]
  end

  Client -->|"connect()"| Mount["mountStandalone<br/>EditorSession.connect"]
  Mount --> MountFn["Editor.mount(context)"]
```

Offline swaps the transport and the storage, nothing else: the session, the
leases and the editor are the online ones. The username prompt is skipped for
a guest identity. Disposing the session destroys the client, which closes the
workspace.
