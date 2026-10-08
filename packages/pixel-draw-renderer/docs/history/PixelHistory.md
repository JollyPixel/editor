# Pixel history

The renderer records no undo by itself. A [`PixelDocument`](../PixelDocument.md) emits an `EditChange` for each edit, with the commands that undo it, and a canvas binds to the history passed in [`PixelArtCanvasOptions.history`](../PixelArtCanvasOptions.md#history). `@jolly-pixel/asset.pixel-art` implements that history on a `CommandHistory` from `@jolly-pixel/history`, and decides which steps a peer edit refuses.

```ts
import { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { StandalonePixelHistory } from "@jolly-pixel/asset.pixel-art/client";

const canvas = new PixelArtCanvas(parent, {
  history: new StandalonePixelHistory({ limit: 20 })
});
```

## `PixelArtCanvasHistory`

```ts
interface PixelArtCanvasHistory {
  bind(
    target: PixelHistoryTarget,
    onChange: (state: PixelHistoryState) => void
  ): PixelHistoryBinding;
}

interface PixelHistoryTarget {
  document: PixelDocument;
  selection: EditSource<SelectionChange>;
}

interface PixelHistoryBinding {
  readonly state: PixelHistoryState;
  undo(): boolean;
  redo(): boolean;
  record: EditGrouping; // <T>(edit: () => T) => T
  release(): void;
}
```

The canvas calls `bind` once when built and `release` from `destroy()`. `record` runs `edit` as one step: the canvas records a selection move, transform or delete together with the pixels it writes. `onChange` runs when the bound steps change; the canvas then restores the selection an undo or redo brought back, in Select mode only, and calls `onHistoryChange`.

## `PixelHistoryState`

```ts
interface PixelHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoCount: number;
  redoCount: number;
}
```

## `EditChange`

```ts
type EditOrigin = "local" | "remote" | "replay";

class EditChange<TCommand> {
  static local<TCommand>(command: TCommand, inverse?: readonly TCommand[]): EditChange<TCommand>;
  static remote<TCommand>(command: TCommand, clientId?: string | null): EditChange<TCommand>;
  static replay<TCommand>(command: TCommand): EditChange<TCommand>;

  readonly command: TCommand;
  readonly origin: EditOrigin;
  readonly inverse: readonly TCommand[];
  readonly clientId: string | null;
}
```

## `EditSource`

```ts
interface EditSource<TCommand> {
  subscribe(event: "change", listener: (change: EditChange<TCommand>) => void): () => void;
  subscribe(event: "reset", listener: (cause: "load") => void): () => void;
  applyStep(command: TCommand): EditChange<TCommand> | null;
}
```

`PixelDocument` is an `EditSource<DocumentCommand>`: it emits `change` for each edit, `reset` with `"load"` after a snapshot, and applies an undo or redo through `applyStep(command)`. `PixelHistoryTarget.selection` is the canvas's selection footprints as an `EditSource<SelectionChange>`: a selection change's inverse swaps `before` and `after`, and applying one restores that footprint once the step completes. This is the `ChangeSource` shape that `ChangeSourceAdapter` from `@jolly-pixel/history` wraps.
