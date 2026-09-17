# AssetSource

`AssetSource` is an immutable view of an asset source string, split into a
directory, a name, and an extension. Asset sources are opaque addresses. This
class does not validate that a source is relative, safe, or supported by a
loader.

## API

```ts
class AssetSource {
  readonly directory: string;
  readonly name: string;
  readonly extension: string;

  constructor(source: string);

  withName(name: string): AssetSource;
  equals(other: AssetSource): boolean;
  toJSON(): string;
  toString(): string;

  static from(source: string | AssetSource): AssetSource;
}
```

The constructor splits `source` at its last `/` and at the first `.` of the
file name after its first character. `directory` keeps its trailing slash and
`extension` its leading dot, so the three parts concatenate back to the
original string. It accepts any string without normalizing or validating it.

| Source | `directory` | `name` | `extension` |
|---|---|---|---|
| `maps/world.voxelmap.json` | `maps/` | `world` | `.voxelmap.json` |
| `.hidden` | | `.hidden` | |
| `v1.2/readme` | `v1.2/` | `readme` | |

`withName()` places `name` between the current `directory` and `extension`, then
parses the result into a new `AssetSource`. A non-empty name without `/` or `.`
keeps the original directory and extension. Other values are accepted, but
reparsing can change those parts.

`from()` constructs a source from a string and returns an existing
`AssetSource` unchanged. `equals()` compares full source strings. `toJSON()`
and `toString()` both return the full source string.

```ts
new AssetSource("textures/block.pixelart").withName("stone").toString();
// "textures/stone.pixelart"
```

[`AssetRecord`](./AssetRecord.md) stores its source as a plain string. Wrap it
when a name or extension is needed.
