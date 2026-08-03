# Debug

`VoxelEngine.debug` exposes a `VoxelDebugger`: live mesh statistics and an
optional wireframe view of the geometry the mesh builder produced.

```ts
const engine = new VoxelEngine({ layers: ["Ground"] });

// Draw the wireframe over the textured chunks.
engine.debug.mode = "overlay";

const { faces, culledFaces, triangles } = engine.debug.stats;
console.log(`${faces} faces, ${culledFaces} culled, ${triangles} triangles`);
```

Counters are collected on every chunk build, whatever the mode; only the
wireframe has a rendering cost. Meshing a 512×512 noise world with the counters
enabled measures within ~1% of the same run without them.

## Modes

| Mode | Effect |
|---|---|
| `"off"` (default) | chunks render normally, nothing is added to the scene graph |
| `"overlay"` | a wireframe copy is drawn over the textured chunks |
| `"wireframe"` | the textured chunks are hidden, leaving only the wireframe |

Wireframes reuse the chunk geometries — switching modes never re-meshes
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

With [greedy meshing](./VoxelEngine.md#greedy-meshing) on, `faces` counts quads
rather than voxel faces, and `mergedFaces` is how many extra voxel faces those
quads absorbed. `faces + mergedFaces` is therefore what the naive builder would
have emitted, which makes the merge ratio readable the same way:

```ts
const { faces, mergedFaces } = engine.debug.stats;
const ratio = (mergedFaces / (faces + mergedFaces)) * 100;
```

Counters for a single chunk are available on the mesh builder itself as
`MeshBuildStats`; `VoxelDebugger` keeps a copy per chunk key and aggregates them
on demand.

## Example

`examples/noise-world.html` wires both to its HUD: `G` cycles the wireframe
modes and the panel shows faces, culling ratio, triangles, vertices and chunk
meshes, refreshed four times per second.

```bash
npm run dev -w @jolly-pixel/voxel.renderer
```
