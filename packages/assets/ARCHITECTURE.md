# Asset workspace architecture

Each directory in `packages/assets` owns one editable format. Its `src/asset/` code defines the kind, stored state, codec integration, and asset dependencies. Its `src/network/` code defines the edit protocol and client sync. A format can keep other domain code elsewhere, such as voxel-model's `src/model/`.

```mermaid
flowchart TB
    Editor["Editor or client"]

    subgraph Workspace["One asset workspace"]
        Asset["src/asset<br/>kind and state"]
        Network["src/network<br/>commands and client sync"]
    end

    Core["@jolly-pixel/asset<br/>references and catalog"]
    Server["@jolly-pixel/asset-server<br/>rooms and event history"]
    Source["@jolly-pixel/asset-source<br/>stored bytes"]

    Editor <--> Network
    Editor -->|"resolve asset IDs"| Core
    Network <--> Server
    Asset -->|"register kind handler"| Server
    Server -->|"publish records"| Core
    Server -->|"read and write"| Source
```

The server owns rooms, the catalog, event history, and persistence. Each asset workspace supplies format-specific state and commands through an asset kind handler. The catalog room handles creation, rename, and deletion; an asset room handles edits to one open asset.

## From edit to stored asset

```mermaid
sequenceDiagram
    participant Editor
    participant Client as Asset client
    participant Room as Asset room
    participant Store as Event store
    participant Source as Asset source

    Editor->>Client: edit an asset
    Client->>Room: send command
    Room->>Room: validate and arbitrate
    Room->>Store: append accepted command
    Store-->>Room: appended
    Room->>Room: apply command to kind state
    Room-->>Client: broadcast command
    Room->>Store: append later asset.updated
    Room->>Source: write serialized snapshot
```

The server replays recorded commands to restore live state and writes serialized snapshots after editing. A kind's apply function is the sole writer of its authoritative state; arbitration is committed after the event append succeeds.

See [asset kinds](../asset-server/docs/AssetKinds.md) and [asset server architecture](../asset-server/ARCHITECTURE.md) for the server contract. [Asset source architecture](../asset-source/ARCHITECTURE.md) describes the storage boundary. Format-specific rules live in the [pixel-art](./pixel-art/ARCHITECTURE.md), [voxel-map](./voxel-map/ARCHITECTURE.md), and [voxel-model](./voxel-model/ARCHITECTURE.md) architecture pages.
