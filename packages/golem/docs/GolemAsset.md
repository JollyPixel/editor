# GolemAsset

An open asset. It sends raw kind commands and tells whether the studio accepted them. Get one from `golem.open` ([Golem](./Golem.md)).

```ts
const scene = await golem.open(assetId, "scene");
await scene.apply([
  { action: "actor-renamed", id: actorId, name: "Player" },
  { action: "actor-transformed", id: actorId, transform: { position: { x: 0, y: 1, z: 0 } } }
]);
await scene.settled();
```

## Properties

```ts
class GolemAsset {
  readonly id: string;
  readonly kind: string;
  readonly unanswered: number; // commands sent and not yet confirmed or refused
  readonly closed: boolean; // true once close() ran
}
```

## Methods

### `apply(commands): Promise<void>`

Checks every command against the kind's schema and the golem's rights, applies them to the local document, then sends them. The SDK adds the command header (`clientId`, `seq`, `timestamp`).

- Throws `CommandInvalidError`, with the command's `index`, when a command does not match the schema or the document cannot apply it as it is now. Nothing is sent when the schema check fails. When the document refuses a command, the commands before it in the batch are already sent.
- Throws `CommandDeniedError` when the owner's role may not write this asset.
- Throws `LockedByPeerError` when a peer holds a lock on what the batch edits, for kinds whose editor has locks.
- Throws `RangeError` for a batch over `MAX_BATCH_COMMANDS` (500).
- Waits before sending while the batch would bring the unanswered commands over `MAX_UNANSWERED_COMMANDS` (1,000), so a runaway loop cannot flood the room.

### `settled(): Promise<void>`

Resolves once the studio has answered every sent command.

- Rejects with `CommandRefusedError` when the studio refused some of them, usually because a peer changed the same thing first. `error.commands` holds the refused commands. Their local effect is already rolled back.
- Rejects with `CommandDeniedError` when the studio denied a command, for example after the owner lost write access.

### `peers(): IterableIterator<Peer>`

The people and agents in this asset's room, without the golem itself.

### `read(): unknown`

The document as JSON.

### `close(): void`

Leaves the room. Pending and later calls fail with `AssetClosedError`.

## `SceneAsset`

The asset for `scene`. Commands are the scene's `SceneCommand`.

### `tree: SceneTreeReader`

The live scene tree: actors, transforms and components. Read actor ids here before editing.

### `read(): SceneSnapshot`

The environment and actors as a scene file stores them.

### `addActors(specs, options?): Promise<AddedActor[]>`

Adds actors with their children and components, then returns `{ id, name }` for each new actor, parents before their children. Await `settled()` before reporting them added.

```ts
const [tower] = await scene.addActors([
  {
    name: "Tower",
    transform: { position: { x: 4, y: 0, z: -2 } },
    components: [{ type: "Light" }],
    children: [{ name: "Roof" }]
  }
], { parentId: null });
await scene.settled();
```

```ts
interface ActorSpec {
  name: string;
  visible?: boolean; // default true
  transform?: Partial<SceneTransformJSON>; // missing fields: position and rotation 0, scale 1
  components?: ComponentSpec[];
  children?: ActorSpec[];
}

interface ComponentSpec {
  type: string;
  data?: SceneComponentJSON["data"]; // default {}
  assets?: Record<string, AssetRef>; // default {}
}

// an asset id, a catalog path such as "models/tree.obj", { id, kind }, or null
type AssetRef = string | { id: string; kind: string; } | null;
```

- Actors and components get ids from `crypto.randomUUID()`.
- `options.parentId` names the actor the specs go under, by name or id; `null`, the default, is the scene root.
- Each top-level spec becomes one `actor-added` command, sent through `apply` in batches of `MAX_BATCH_COMMANDS`.
- Throws `TypeError` and sends nothing when `parentId` is a prefab instance, which cannot hold children.

### `transformActors(changes): Promise<void>`

Sends one `actor-transformed` per `{ actor, transform }`. `transform` holds only the fields that change, relative to the parent.

### `moveActors(actors, options): Promise<void>`

Moves `actors` under `options.parent`, `null` for the root, in the given order: before the child `options.before` names, or after the last child. Each actor keeps its transform, which is relative to its parent, so a moved actor shifts in the world when its new parent is placed elsewhere.

### `removeActors(actors): Promise<void>`

Removes `actors` with their descendants. An actor listed with one of its ancestors is removed once.

### `addComponents(actor, specs): Promise<AddedComponent[]>`

Adds `ComponentSpec` components to `actor` and returns `{ id, type }` for each. Throws `TypeError` for a prefab instance, which takes no components.

### Actors and assets by name

Every actor argument takes a name or an id.

- A name no actor has, or one several actors share, throws `UnknownEntryError`; `error.candidates` lists the sharing actors' ids with their parent's name.
- An asset slot naming no asset id or catalog path throws `UnknownAssetError`.
- Both are thrown before anything is sent.

### Component checks

The studio stores any component `type`, so `apply` and the intent methods check each added component, and each `component-assets-changed`, against the components the studio's editors declare:

- a type no editor declares throws `UnknownComponentError`; `error.known` lists the declared types;
- a slot the type does not have, or an asset of another kind, throws `ComponentSlotError`.

Both errors and the `SceneComponentTypes` that throws them come from `@jolly-pixel/server`.

Nothing is sent when either is thrown.

### Focus

After each batch, the golem's selection presence (`actor`) moves to the last actor the batch touched, so the scene editor shows it the way it shows a person's selection.

## `TextAsset`

The asset for `script`, `shader` and `text`. Its one command is `{ action: "edited", changes }`, where each change is `{ at, insert }` or `{ at, delete }` with `at` an offset in UTF-16 code units, applied in order. `replace` and `write` build it for you.

```ts
const notes = await golem.open(assetId, "text");
await notes.replace("- bread", "- milk");
await notes.settled();
```

### `text: string` and `lineCount: number`

The current text and its number of lines. A text ending with a line break counts the empty line after it.

### `read(): string`

The whole text, as `text`.

### `lines(range): TextLines`

The lines `range.from` to `range.to` (default: the last line), counted from 1, as `{ from, to, lineCount, text }`. `text` joins them with `\n` and `to` is capped at `lineCount`. Throws `RangeError` when `from` is below 1 or `to` is below `from`. A range past the end reads `""`.

### `replace(search, replacement, options?): Promise<number>`

Replaces `search`, matched exactly, and returns how many occurrences it replaced.

- Throws `TextMatchError` when `search` is missing, or appears more than once and `options.all` is not `true`. `error.matches` holds the count.
- Throws `TypeError` for an empty `search`.

### `write(text): Promise<void>`

Replaces the whole text. Only the part that differs is sent, so people's carets outside it stay put. Sends nothing when the text is unchanged.

### Focus

After each batch, the golem's caret presence (`caret`) moves to the end of the batch's last change, so the script editor shows it like a person's caret.

## `VoxelMapAsset`

The asset for `voxelmap`. Commands are the map's world commands (`VoxelWorldCommand`: layers, voxels, objects, templates, blocksets). Positions are whole cells and y is up. A box is `{ min, max }` with both corners included.

```ts
const map = await golem.open(assetId, "voxelmap");
await map.fillBox({ min: { x: 0, y: 0, z: 0 }, max: { x: 15, y: 0, z: 15 } }, "grass", { layer: "Ground" });
await map.settled();
```

Opening a map also opens the blockset assets it links, so its blocks have names. `summary()` and every write open the blocksets the map gained since, and open again a blockset whose asset was closed. Closing the map closes those blocksets, except the ones the caller opened itself.

### `summary(): Promise<MapSummary>`

The chunk size, the voxel count, the layers (`id`, `name`, `visible`, `voxelCount`, and `bounds`, `null` for an empty layer), the blocksets (`id`, `slot`, `assetId`, `linked`, and `error` when its asset could not be opened) and the blocks (`id`, `name`, `shapeId`, `blockset`). `read()` returns the same summary at once, without opening blocksets.

### `query(box, options?): MapQuery`

The occupied cells of `box` as `{ x, y, z, block, layer }`. With `options.layer` it reads that layer only; without, the cell each position shows across layers. Stops at `MAX_QUERY_CELLS` (4,096) and sets `truncated`.

### `heightmap(box, options?): MapHeightmap`

For each column of `box`, the highest occupied y within it, or `null`. `heights` holds one row per z from `min.z`, one value per x from `min.x`.

### `addLayer(name, options?): Promise<AddedLayer>`

Adds an empty layer on top, or right above the layer `options.above` names, and returns its `{ id, name }`. When another layer has `name`, the studio appends a number: `"Ground (1)"`.

### `fillBox(box, block, options): Promise<number>`

Puts `block` in every cell of `box` on `options.layer`, a layer name or id, and returns the number of cells written. Writes go out as `voxels-patched` commands of at most `MAX_PATCH_CELLS` (32,768) cells.

### `clearBox(box, options): Promise<number>`

Empties the occupied cells of `box` on `options.layer` and returns how many it emptied.

### `writeVoxels(voxels, options): Promise<number>`

Writes `{ position, block }` entries on `options.layer`; a `null` block empties the cell.

### Blocks, boxes and errors

- A block is a name, `"<blockset>/<name>"` when two blocksets share the name, or a block id. A name matching no block, or several, throws `UnknownBlockError`; `error.candidates` lists the qualified matches.
- A layer that does not exist throws `UnknownEntryError`. `voxelmap_summary` and `summary()` list the layers.
- A box with a corner that is not a whole cell, `min` above `max`, or more than `MAX_BOX_CELLS` (1,000,000) cells throws `RangeError`.

### Focus

After each batch that writes voxels, the golem's brush presence (`brush`) moves to the last written cell, so the voxel-map editor shows it like a person's brush.

## `BlocksetAsset`

The asset for `blockset`. Commands are its block, material group and blend group commands (`block-defined`, `material-group-defined`, `tile-size-updated`, …) and the pixel-art commands of its texture; one batch can mix both.

### `pixels: PixelSurface`

The blockset's texture, painted and read like a pixel-art texture's ([`PixelSurface`](#pixelsurface)).

### `blocks(): BlockSummary[]`

The blocks as `{ id, name, shapeId, tiles }`, ids local to the blockset. `tiles` maps each face slot of `faceTextures`, and `default` for `defaultTexture`, to the `{ x, y, width, height }` it draws from on the texture.

### `read(): BlocksetDocumentJSON`

The tile size, blocks, material groups and blend groups.

### `link(map, slot): BlocksetLink`

Projects the blocks into `map`, a voxel document, under `slot`, and keeps them in step with the blockset. Dispose the link to stop. `VoxelMapAsset` links its blocksets this way.

## `VoxelModelAsset`

The asset for `voxelmodel`. Commands are the model's `VoxelModelCommand`: nodes (folders and blocks), materials and animation sets. Node and material arguments take a name or an id; a name matching nothing, or several entries, throws `UnknownEntryError` with the ids in `error.candidates`.

```ts
const model = await golem.open(assetId, "voxelmodel");
await model.addMaterials([{ name: "Steel", surface: { metalness: 1 } }]);
await model.addBlocks([{ name: "Arm", material: "Steel", shape: { type: "cylinder", sides: 8 } }]);
await model.settled();
```

### `tree: ModelTreeReader`

The live node and material trees.

### `read(): VoxelModelSnapshot`

The nodes, materials and animation sets as the model file stores them.

### `addBlocks(specs, options?): Promise<AddedBlock[]>`

Adds blocks under `options.parent`, a node name or id, or at the root, and returns `{ id, name, uv, shared }` for each. Each block's UV net goes in the first free space on the model's pixel-art texture, as the editor places a new block. When the nets do not fit, the golem first resizes the texture, doubling its shorter side until they do; existing pixels keep their place. `uv` is the `{ x, y, width, height }` the net covers, to paint through the texture's `pixels`. `shared` is `true` only when the texture reached its largest size and the net overlaps another one. The lock check runs before the resize: a `LockedByPeerError` leaves the texture as it was.

```ts
interface BlockSpec {
  name: string;
  shape?: BlockShapeJSON; // default { type: "box" }
  transform?: Partial<BlockTransformJSON>; // missing fields: position, rotation, pivot 0, size and scale 1
  material?: string; // a material name or id
}
```

### `addMaterials(specs): Promise<AddedEntry[]>`

Adds materials at the root of the material tree from `{ name, surface? }`, missing surface fields taking the default, and returns `{ id, name }` for each.

### Locks

Before sending a batch, `apply` reads the peers' locks and throws `LockedByPeerError` when one holds what the batch edits: the transform lock of a block that is moved, transformed or removed, or the field lock of a material field that is renamed, changed or removed with its material. `holdsModelLock` from `@jolly-pixel/asset.voxel-model` decides which lock covers which value. `error.peer` names the peer and `error.target` what it holds. Wait, or ask in the chat.

### Focus

After each batch, the golem's block mark (`block`) moves to the last block the batch touched, as the voxel-model editor shows a person's selection.

## `PixelArtAsset`

The asset for `pixelart`, a texture people paint in the pixel-art editor. Commands are its document commands as JSON carries them (`stroke` with `positions`, `palette-replaced`, UV region and normal map commands); `texture-replaced`, which carries raw bytes, is left out. Colors are what `Color.from` from `@jolly-pixel/color` parses, such as `"#rrggbb"`, `"#rrggbbaa"` or `"red"`, and a malformed one throws `ColorParseError`.

```ts
const texture = await golem.open(assetId, "pixelart");
await texture.pixels.fillRect({ x: 0, y: 0, width: 16, height: 4 }, "#3a7d2c");
await texture.pixels.paintPixels([{ x: 3, y: 1, color: "#ffffff80" }]);
await texture.settled();
```

### `pixels: PixelSurface`

The texture's pixels ([`PixelSurface`](#pixelsurface)).

### `read(): PixelArtSummary`

`pixels.summary()`.

### Focus

After each batch with a stroke, the golem's cursor (`cursor`) moves to the last painted pixel, as the pixel-art editor shows a person's cursor. A blockset publishes the same cursor.

## `PixelSurface`

The pixels of a `PixelArtAsset` or a `BlocksetAsset` texture. Its writes go through the asset's `apply`, so `settled()` on the asset waits for them. Colors are what `Color.from` from `@jolly-pixel/color` parses, such as `"#rrggbb"`, `"#rrggbbaa"` or `"red"`, and a malformed one throws `ColorParseError`. A position or rect that is not whole pixels inside the texture throws `RangeError` before anything is sent.

### `size: Vec2` and `maxSize: number`

The texture's size, and the largest side `resize` accepts.

### `summary(): PixelArtSummary`

The size, the palette as `"#rrggbbaa"` strings and the UV regions as `{ id, name, bounds }`, without the pixels.

### `readPixels(rect): PixelRead`

The colors of `rect` (`{ x, y, width, height }`), one row per y, as `"#rrggbbaa"`. Throws `RangeError` for more than `MAX_READ_PIXELS` (4,096) pixels.

### `paintPixels(pixels): Promise<number>`

Paints `{ x, y, color }` entries, one `stroke` per color, and returns how many it painted.

### `fillRect(rect, color): Promise<number>`

Paints every pixel of `rect` with `color`. Strokes hold at most `MAX_STROKE_PIXELS` (16,384) pixels.

### `replacePalette(colors): Promise<void>`

Replaces the palette the editor offers. It repaints nothing.

### `resize(size): Promise<void>`

Resizes the texture to `size` (`{ x, y }`), keeping the pixels that fit from the top-left corner. Neither side may exceed `maxSize`.
