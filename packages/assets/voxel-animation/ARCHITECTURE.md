# Voxel-animation architecture

`AnimationSet` is both the server's headless set and the state behind `AnimationDocument` on the client. Its snapshot holds a `rig` label and the clips, in order; each clip holds tracks of keys addressed by block name path. The stored document leaves out a key's `interpolation` when it is `"linear"`, and the decoder fills it back in. A set knows nothing about models: a model links it and binds its tracks to blocks, see [animation bindings](../voxel-model/docs/animation.md). The shared room and persistence lifecycle is shown in [asset workspace architecture](../ARCHITECTURE.md).

```mermaid
flowchart TB
    Document["AnimationDocument"] --> Sync["DocumentSyncClient"]
    Sync --> Room["Animation room"]
    Room --> Arbiter["AnimationCommandArbiter"]
    Arbiter --> Log["Event log"]
    Log --> State["AnimationSet"]
    State --> Clips["Clips"]
    Clips --> Tracks["Tracks by path"]
    Tracks --> Keys["Keys per channel"]
    Room -->|"command or snapshot"| Sync
```

## Collision keys

```mermaid
flowchart LR
    Rig["rig-renamed"] --> RigKey["rig"]
    Change["clip-changed"] --> Field["clip:id:field for each patched field"]
    Move["clip-moved"] --> Order["clip-order:id"]
    Remove["clip-removed"] --> RemoveKeys["clip-order:id and every clip:id:field"]
    Key["key-set / key-removed"] --> KeyKey["key:clip:path key:channel:tick"]
    Structure["clip-added / track-removed / track-renamed"] --> Room["Set validation and room order"]
```

The default resolver is last write wins. The arbiter checks the set rules through `state.accepts()` before the conflict keys. A key's path is keyed by its `TrackPath` key, so `Body/Arm.L` and `body/arm.l` collide. A removal is only refused for its keys when it carries a `basis`, as an undo does: a peer's newer write to the clip then refuses it. Keys inside the removed clip are not covered. See the [network API](./docs/network.md) for command and client details.
