# UvNetLibrary

The [UV nets](../../../../pixel-draw-renderer/docs/uv/UVNet.md) a `PixelDrawPanel` offers when a
region unfolds, and the one it uses by default. The nets a user makes are saved in the texture's
pixel document, so they are written to its `.pixelart` file and every peer editing that texture
sees them. Another texture has its own nets.

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

The library lists three kinds of nets, in this order. The built-in nets, `UV_NET_PRESETS`, are
*Packed* (`"packed"`, the renderer's packing net) and *Cross* (`"cross"`, the classic box cross).
Then come the host's `presets`, and last the nets saved in the open texture. Built-in and host
nets are locked; the user edits copies of them.

In the panel, the region state menu lists every net under "Unfold with". A net that has no cell
for one of the region's active slots is greyed out, and its tooltip names the missing slots.
Choosing "Unfolded" uses the default net, and so does every other unfold that does not name one,
such as a host unfolding a region itself. "Edit nets" opens the dialog where nets are created,
renamed, rearranged, made the default or deleted. Double-click or F2 renames a net in the list.
Dropping a slot on a cell that already holds one makes them share it.

## Constructor

```ts
interface UvNetPresetInit {
  id: string;
  name: string;
  rows: Iterable<Iterable<UVNetCellInput>> | null;
}

interface UvNetLibraryOptions {
  presets?: readonly UvNetPresetInit[];
  defaultId?: string;
}

new UvNetLibrary(options?: UvNetLibraryOptions)
```

`rows` follows the [`UVNet` constructor](../../../../pixel-draw-renderer/docs/uv/UVNet.md#constructor);
`null` is the packing net. `defaultId` is the default of a texture that has none, or whose default
net was deleted. It falls back to `"packed"` when no locked net has that id.

## Document

```ts
type UvNetDocument = Pick<
  PixelDocument,
  "uvNets" | "saveUvNet" | "deleteUvNet" | "changeDefaultUvNet" | "subscribe"
>;

get document(): UvNetDocument | null
set document(document: UvNetDocument | null)
```

The `PixelDocument` whose saved nets the library lists and edits. The panel sets it to the active texture's document. Setting it
emits `"change"`, and so does every change to the document's nets, local or from a peer. A saved
net that reuses a locked id is not listed. While `document` is `null`, the library lists only
locked nets and its edits change nothing and return `null` or `false`.

## Members

```ts
get default(): UvNetPreset
get defaultId(): string
changeDefault(id: string): boolean
get(id: string): UvNetPreset | undefined
[Symbol.iterator](): IterableIterator<UvNetPreset>
```

`changeDefault()` saves the default net in the document. It returns `false` for an unknown id or
when no document is set.

```ts
create(name: string, rows?: UvNetRowsInput): UvNetPreset | null
duplicate(id: string): UvNetPreset | null
update(id: string, changes: { name?: string; rows?: UvNetRowsInput; }): boolean
delete(id: string): boolean
```

`create()` starts from one row of the six box faces when `rows` is omitted, and returns `null`
without a document. `duplicate()` copies any net under the name `"<name> copy"`; a copy of
*Packed* starts from that same row. `update()` and `delete()` return `false` for a locked or
unknown net, and `update()` also refuses rows the `UVNet` constructor rejects, such as a grid
without slots. Each change is a document command, so it is undoable, saved with the texture and
sent to peers.

## UvNetPreset

```ts
class UvNetPreset {
  readonly id: string;
  readonly name: string;
  readonly net: UVNet;
  readonly locked: boolean;
  readonly rows: readonly UVNetRow[] | null;

  fits(slots: Iterable<UVSlot>): boolean;
}
```

An immutable net entry. `fits()` is true when the net has a cell for every slot.

## Console

`pixelArtConsole()` registers `pixelart.nets` through `uvNetConsole`:

- `/pixelart.nets.list` prints every net id and name, marking the default and the locked ones.
- `/pixelart.nets.default cross` makes *Cross* the open texture's default net. An unknown id, or
  no open texture, prints an error.
