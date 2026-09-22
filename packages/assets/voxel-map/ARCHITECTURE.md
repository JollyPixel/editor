# Voxel-map architecture

`VoxelMapState` is the server's headless world. Its snapshot includes the world, block definitions, tilesets, and default tile size. Asset-backed tilesets become catalog dependencies. The shared room and persistence lifecycle is shown in [asset workspace architecture](../ARCHITECTURE.md).

```mermaid
flowchart TB
    Document["VoxelDocument"] --> Sync["VoxelSyncClient"]
    Sync --> Room["Asset room"]
    Room --> Arbiter["VoxelCommandArbiter"]
    Arbiter --> Log["Event log"]
    Log --> State["VoxelMapState"]
    State --> World["World"]
    State --> Blocks["BlockRegistry"]
    State --> Tilesets["TilesetList"]
    Room -->|"command or snapshot"| Sync
```

## Collision keys

```mermaid
flowchart TB
    Command["Voxel command"] --> Action{"Target"}
    Action -->|"voxel"| Cell["layer:x,y,z"]
    Action -->|"object"| Object["object:id"]
    Action -->|"block"| Block["block:id"]
    Action -->|"tileset"| Tileset["tileset:id"]
    Action -->|"default tile size"| Size["default-tile-size"]
    Action -->|"layer lifecycle or world-replace"| Order["Room order"]
```

Bulk voxel commands arbitrate each cell and retain the entries that win. The default resolver is last write wins. The room commits admissions after a successful append; `commands.apply` then folds the command into state. `world-replace` loads a full document and broadcasts a fresh snapshot. See the [network API](./docs/network.md) for command and client details.
