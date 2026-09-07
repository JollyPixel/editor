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
  admit<TCommand extends VoxelNetworkCommand>(
    command: TCommand
  ): TCommand | null;
  record(command: VoxelNetworkCommand): void;

  static key(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string | null;
  static keys(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string[];
}
```

The default resolver is `network.LastWriteWinsResolver`. `admit()` returns the
part of the command that wins, `null` when none of it does; it does not record
the result. Call `record()` with the admitted command once it has been applied
successfully.

A bulk command (`voxels-set`, `voxels-removed`) contends for each of its cells
on its own: `admit()` returns a copy narrowed to the entries that win, so one
contested cell never drops the rest of a brush stroke. It returns the command
itself when every entry wins.

`key()` returns `"<layer>:<x>,<y>,<z>"` for single voxel placement and removal,
`"block:<id>"` for block definitions, and `"object:<id>"` for every object
command, including `"object-moved"`. Objects are keyed by id alone rather than
by layer, so a move that spans two layers still conflicts with a concurrent edit
of the same object. Layer lifecycle actions return `null` and do not conflict;
they converge through the server's command ordering instead.

`keys()` returns one key per cell, so a bulk command reports every cell it
touches.
