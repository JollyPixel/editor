# UvNetLibrary

The [UV nets](../../../../pixel-draw-renderer/docs/uv/UVNet.md) a `PixelDrawPanel` offers when a
region unfolds, and the one it uses by default. Nets are per browser: they shape the geometry an
unfold produces, and only that geometry is saved and sent to peers.

```ts
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import {
  UvNetLibrary,
  pixelArtConsole
} from "@jolly-pixel/editor.pixel-art";

const uvNets = new UvNetLibrary({
  storage: new LocalStorageAdapter(),
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
Then come the host's `presets`, and last the nets the user made. Built-in and host nets are
locked; the user edits copies of them.

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
  storage?: StorageAdapter;
  presets?: readonly UvNetPresetInit[];
  defaultId?: string;
}

new UvNetLibrary(options?: UvNetLibraryOptions)
```

`storage` defaults to a `MemoryStorageAdapter`, which forgets user nets on reload. User nets and
the chosen default are stored under `UV_NETS_STORAGE_KEY` (`"pixel-art:uv-nets"`). A stored net
that no longer parses, or reuses a locked id, is dropped.

`rows` follows the [`UVNet` constructor](../../../../pixel-draw-renderer/docs/uv/UVNet.md#constructor);
`null` is the packing net. `defaultId` is the default until the user picks another one, and when
the user's default is deleted. It falls back to `"packed"` when no locked net has that id.

## Members

```ts
get default(): UvNetPreset
get defaultId(): string
set defaultId(id: string)
get(id: string): UvNetPreset | undefined
[Symbol.iterator](): IterableIterator<UvNetPreset>
```

Setting `defaultId` to an unknown id does nothing.

```ts
create(name: string, rows?: UvNetRowsInput): UvNetPreset
duplicate(id: string): UvNetPreset | null
update(id: string, changes: { name?: string; rows?: UvNetRowsInput; }): boolean
delete(id: string): boolean
```

`create()` starts from one row of the six box faces when `rows` is omitted. `duplicate()` copies
any net under the name `"<name> copy"`; a copy of *Packed* starts from that same row. `update()`
and `delete()` return `false` for a locked or unknown net, and `update()` also refuses rows the
`UVNet` constructor rejects, such as a grid without slots. Every change is saved and emits
`"change"`.

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
- `/pixelart.nets.default cross` makes *Cross* the default net. An unknown id prints an error.
