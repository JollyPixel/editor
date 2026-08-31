# VoxelCommandArbiter

`VoxelCommandArbiter` tracks accepted voxel commands and delegates conflict
decisions to a `network.ConflictResolver`.

## API

```ts
interface VoxelCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

class VoxelCommandArbiter {
  constructor(options?: VoxelCommandArbiterOptions);
  resolve(command: VoxelNetworkCommand): boolean;
  record(command: VoxelNetworkCommand): void;

  static key(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string | null;
}
```

The default resolver is `network.LastWriteWinsResolver`. `resolve()` reports
whether the command is accepted; it does not record the result. Call `record()`
after the command has been applied successfully.

`key()` returns `"<layer>:<x>,<y>,<z>"` for voxel placement and removal. Other
actions return `null` and therefore do not conflict by position.
