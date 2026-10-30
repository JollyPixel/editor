# UvNetLibrary

The `UVNet`s a `PixelDrawPanel` offers when a region unfolds, and the one it
uses by default. Nets a user makes are saved in the texture's pixel document,
so they go into its `.pixelart` file and reach every peer.

```ts
import {
  UvNetLibrary,
  pixelArtConsole
} from "@jolly-pixel/editor.pixel-art";

const uvNets = new UvNetLibrary({
  presets: [
    {
      id: "voxel-map:caps-sides",
      name: "Top/bottom + sides",
      rows: [[["top", "bottom"], ["front", "back", "left", "right"]]]
    }
  ],
  defaultId: "voxel-map:caps-sides"
});

panel.uvNets = uvNets;
const features = pixelArtConsole(commands, { keyBindingSettings, uvNets });
```

- Nets are listed in order: built-in `UV_NET_PRESETS` (`"packed"`, `"cross"`),
  host `presets`, then the nets saved in the open texture.
- Built-in and host nets are locked; the user edits copies.
- An unfold that names no net uses the default net.

## Constructor

```ts
interface UvNetPresetInit {
  id: string;
  name: string;
  rows: Iterable<Iterable<UVNetCellInput>> | null; // null is the packing net
}

interface UvNetLibraryOptions {
  presets?: readonly UvNetPresetInit[];
  defaultId?: string;
}

new UvNetLibrary(options?: UvNetLibraryOptions)
```

`defaultId` is the default of a texture that has none, or whose default was
deleted. It falls back to `"packed"` when no locked net has that id.

## Document

```ts
type UvNetDocument = Pick<
  PixelDocument,
  "uvNets" | "saveUvNet" | "deleteUvNet" | "changeDefaultUvNet" | "subscribe"
>;

document: UvNetDocument | null
```

- The panel sets it to the active texture's document.
- Setting it emits `"change"`, and so does every change to the document's nets,
  local or from a peer.
- A saved net reusing a locked id is not listed.
- While `null`, only locked nets are listed and edits return `null` or `false`.

## Methods

```ts
get default(): UvNetPreset
get defaultId(): string
get(id: string): UvNetPreset | undefined
[Symbol.iterator](): IterableIterator<UvNetPreset>
```

Each edit below is an undoable document command, saved with the texture and
sent to peers.

### changeDefault(id: string): boolean

Returns `false` for an unknown id or without a document.

### create(name: string, rows?: UvNetRowsInput): UvNetPreset | null

Starts from one row of the six box faces when `rows` is omitted.

### duplicate(id: string): UvNetPreset | null

Copies any net as `"<name> copy"`.

### update(id: string, changes: { name?: string; rows?: UvNetRowsInput }): boolean

Returns `false` for a locked or unknown net, or rows the `UVNet` constructor
rejects.

### delete(id: string): boolean

Returns `false` for a locked or unknown net.

## UvNetPreset

```ts
class UvNetPreset {
  readonly id: string;
  readonly name: string;
  readonly net: UVNet;
  readonly locked: boolean;
  readonly rows: readonly UVNetRow[] | null;

  fits(slots: Iterable<UVSlot>): boolean; // a cell for every slot
}
```

## Console

`pixelArtConsole()` registers `pixelart.nets`:

- `/pixelart.nets.list` prints every net, marking the default and locked ones.
- `/pixelart.nets.default cross` sets the open texture's default net.
