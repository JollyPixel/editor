# SnapshotDocument

A [`CommandDocument`](./CommandDocument.md) that takes no command and only changes when a snapshot loads. It fits an asset that a sync client reads but never edits, such as an imported font or texture.

```ts
class FontDocument extends SnapshotDocument<Typeface | null> {
  constructor() {
    super(null, (typeface) => typeface);
  }
}

const font = new FontDocument();
font.subscribe("reset", () => console.log(font.value));
font.load(typeface); // emits reset with "load"
```

## Constructor

```ts
new SnapshotDocument<TSnapshot, TValue = TSnapshot>(
  empty: TValue,
  decode: (snapshot: TSnapshot) => TValue
)
```

`empty` is the value before the first snapshot. `load(snapshot)` replaces the value with `decode(snapshot)`.

## Properties

### value: TValue

The value decoded from the last loaded snapshot, or `empty`.

## Methods

The command type is `never`, so the document emits no `change` and has no change to `revert()`. It keeps the `load()` and events of `CommandDocument`.
