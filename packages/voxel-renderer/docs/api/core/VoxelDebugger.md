# VoxelDebugger

`VoxelEngine.debug` exposes a `VoxelDebugger`: live mesh statistics and an
optional wireframe view of the geometry the mesh builder produced.

```ts
import { VoxelEngine } from "@jolly-pixel/voxel.renderer";

const engine = new VoxelEngine({ layers: ["Ground"] });

// Draw the wireframe over the textured chunks.
engine.debug.mode = "overlay";

const { faces, culledFaces, triangles } = engine.debug.stats;
console.log(`${faces} faces, ${culledFaces} culled, ${triangles} triangles`);
```

Counters are collected on every chunk build, whatever the mode; only the
wireframe has an additional rendering cost.

## API

```ts
class VoxelDebugger {
  mode: VoxelDebugMode;
  enabled: boolean;
  readonly stats: VoxelDebugStats;

  constructor(
    parent: THREE.Object3D,
    options?: VoxelDebuggerOptions
  );
  nextMode(): VoxelDebugMode;
  registerChunk(
    key: string,
    meshes: readonly THREE.Mesh[],
    stats: MeshBuildStats
  ): void;
  unregisterChunk(key: string): void;
  clear(): void;
  dispose(): void;
}
```

`registerChunk()` copies the supplied statistics. Re-registering a key replaces
its meshes and counters. `unregisterChunk()` ignores unknown keys. `clear()`
removes all tracked chunks and overlays; `dispose()` also releases the debug
material.

## Modes

| Mode | Effect |
|---|---|
| `"off"` (default) | chunks render normally, nothing is added to the scene graph |
| `"overlay"` | a wireframe copy is drawn over the textured chunks |
| `"wireframe"` | the textured chunks are hidden, leaving only the wireframe |

Wireframes reuse the chunk geometries. Switching modes never re-meshes
anything and costs no extra vertex memory, only one draw call per chunk mesh.
While a mode other than `"off"` is active, a `THREE.Group` named
`"VoxelDebugger"` holds them under `engine.root`.

```ts
// Cycle off → overlay → wireframe → off, e.g. from a keybinding.
document.addEventListener("keydown", (event) => {
  if (event.code === "KeyG") {
    engine.debug.nextMode();
  }
});

// Booleans work too: `enabled = true` selects "overlay".
engine.debug.enabled = false;
```

The initial state comes from `VoxelEngineOptions.debug`:

```ts
interface VoxelDebuggerOptions {
  /** @default "off" */
  mode?: VoxelDebugMode;
  /** @default 0x66FF99 */
  color?: THREE.ColorRepresentation;
  /** Wireframe opacity, `1` disables blending. @default 0.5 */
  opacity?: number;
}
```

## Statistics

`debug.stats` sums the last build of every chunk currently meshed, so it follows
chunk rebuilds, layer removals and `load()` without ever being stale.

```ts
interface VoxelDebugStats {
  /** Chunks the mesh builder processed, including those emitting no face. */
  chunks: number;
  /** Chunk meshes attached to the scene graph, i.e. one draw call each. */
  meshes: number;
  /** Voxels visited. */
  voxels: number;
  /** Voxels skipped because a higher-priority layer covers the position. */
  hiddenVoxels: number;
  /** Faces written to a geometry. */
  faces: number;
  /** Faces skipped because an opaque neighbour occludes them. */
  culledFaces: number;
  /** Voxel faces greedy meshing folded into a neighbour's quad; 0 when off. */
  mergedFaces: number;
  vertices: number;
  triangles: number;
  /** faces / (voxels - hiddenVoxels). */
  facesPerSolidVoxel: number;
  /** Vertex attributes emitted, in bytes per vertex; indices excluded. */
  bytesPerVertex: number;
  /** Sum of the last build time of every live chunk, not a frame cost. */
  buildTimeMs: number;
}
```

`faces + culledFaces` is the number of face candidates, which makes the culling
ratio directly readable:

```ts
const { faces, culledFaces } = engine.debug.stats;
const ratio = (culledFaces / (faces + culledFaces)) * 100;
```

With [greedy meshing](../../concepts/rendering-and-meshing.md#greedy-meshing) on,
`faces` counts quads
rather than voxel faces, and `mergedFaces` is how many extra voxel faces those
quads absorbed. `faces + mergedFaces` is therefore what the naive builder would
have emitted, which makes the merge ratio readable the same way:

```ts
const { faces, mergedFaces } = engine.debug.stats;
const ratio = (mergedFaces / (faces + mergedFaces)) * 100;
```

The two derived figures are the ones worth watching for regressions:

- `facesPerSolidVoxel` should decrease when greedy meshing combines faces. If it
  does not, inspect the merge predicates and the blocks in the measured chunks.
- `bytesPerVertex` is read off the emitted geometries, not off a constant, so an
  attribute that quietly widens (or a dropped one that comes back) shows up here
  with no code change needed. The current layouts report 19 without greedy
  meshing and 35 with it. `tileRegion`, `tileRepeat`, and float tile UVs account
  for the difference.

`MeshBuildStats` holds the counters for a single chunk build. `VoxelDebugger`
keeps a copy per chunk key and aggregates them on demand.

```ts
class MeshBuildStats {
  voxels: number;
  hiddenVoxels: number;
  faces: number;
  culledFaces: number;
  mergedFaces: number;
  vertices: number;
  triangles: number;
  geometries: number;
  bytesPerVertex: number;
  buildTimeMs: number;

  readonly facesPerSolidVoxel: number;

  reset(): void;
  copyFrom(source: MeshBuildStats): void;
  clone(): MeshBuildStats;
}
```

All counters start at `0`. `facesPerSolidVoxel` is `faces` divided by
`voxels - hiddenVoxels`; it returns `0` when no voxel contributed geometry.
`reset()` clears the instance. `copyFrom()` replaces every field with another
instance's counters, and `clone()` returns an independent copy.

## Example

`examples/noise-world.html` wires both to its HUD: `G` cycles the wireframe
modes and the panel shows faces, culling ratio, triangles, vertices and chunk
meshes, refreshed four times per second.

```bash
npm run dev -w @jolly-pixel/voxel.renderer
```
