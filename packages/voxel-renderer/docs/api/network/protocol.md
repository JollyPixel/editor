# Network protocol

Voxel synchronization uses engine hook events plus one administrative command.

```ts
interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

type VoxelNetworkCommand =
  (VoxelLayerHookEvent | VoxelWorldReplaceCommand)
  & network.NetworkCommandHeader;

type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON
>;
```

`NetworkCommandHeader` supplies `clientId`, `seq`, and `timestamp`. Server
messages contain either a command or a world snapshot.

## Validation

```ts
function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand;
```

The check is deliberately shallow. It verifies only that the value is a
non-null object with `action` and `clientId` properties. Validate untrusted
payloads before they reach `VoxelSyncServer` when the room crosses a trust
boundary.

## Headless application

```ts
world.applyRemoteCommand(command: VoxelLayerHookEvent): void;
```

[`VoxelWorld.applyRemoteCommand()`](../world/VoxelWorld.md#hooks) replays one
mutation against a bare `VoxelWorld` without echoing it back through
`onLayerUpdated`. It is used by the server and is also available to tests,
offline tools, and other headless integrations.
