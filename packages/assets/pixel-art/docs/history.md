# Pixel-art history

Undo and redo of a pixel document run on a [`CommandHistory`](../../../history/docs/CommandHistory.md). This package registers the document's changes in it, decides which steps a peer edit refuses, and gives a `PixelArtCanvas` its history. Everything below is exported from `@jolly-pixel/asset.pixel-art/client`.

## On a canvas

```ts
class StandalonePixelHistory implements PixelArtCanvasHistory {
  constructor(options?: { limit?: number; });
}

class SharedPixelHistory<TScope extends string> implements PixelArtCanvasHistory {
  constructor(history: CommandHistory<TScope>, scope: TScope);
  readonly history: CommandHistory<TScope>;
  readonly scope: TScope;
}
```

Pass either one as [`PixelArtCanvasOptions.history`](../../../pixel-draw-renderer/docs/PixelArtCanvasOptions.md#history).

- `StandalonePixelHistory` keeps one history per document, with one `pixels` scope, `limit` steps deep (10 by default). Every canvas bound to the same document through any `StandalonePixelHistory` shares that history, which lives as long as the document; the first binding sets its `limit`.
- `SharedPixelHistory` drives `scope` of a history the host owns, next to other documents' steps. The host registers the document with `registerPixelHistory`; the canvas only adds its selection to the steps. Closing the canvas leaves the document registered: its pixel steps still undo, and steps holding its selection are refused as `closed`.

```ts
const history = new CommandHistory<"build">();
registerPixelHistory(history, document, { scope: "build" });

const canvas = new PixelArtCanvas(parent, {
  document,
  history: new SharedPixelHistory(history, "build")
});
```

## Registering a document

```ts
function registerPixelHistory<TScope extends string>(
  history: CommandHistory<TScope>,
  document: PixelDocument,
  options: { id?: string; scope: TScope; }
): () => void;

function pixelHistoryRegistration<TScope extends string>(
  document: PixelDocument,
  options: { id?: string; scope: TScope; }
): HistoryRegistration<TScope, DocumentCommand, null, PixelKeySet, PixelCapture>;

function pixelHistoryKeys(
  document: PixelDocument
): HistoryKeys<DocumentCommand, null, PixelKeySet, PixelCapture>;
```

`registerPixelHistory` registers the document in `history` and files each `document.batch()` as one step of `scope`; it returns the release. A document can be registered in several histories: each files the batch as one step. `pixelHistoryRegistration` alone files every local change of the document in `scope` and labels it by action ("Paint", "Resize texture", "Move UV"...).

`pixelHistoryKeys` names what each command writes and what a step must find unchanged, as a `PixelKeySet` of pixels, or the whole texture, and named keys:

- `stroke` and `select-edit` write their pixels.
- `global-fill`, `resized` and `texture-replaced` write the whole texture; a step undoing them guards every pixel.
- `palette-color-changed` writes `palette:<index>`.
- `uv-region-*` writes the region and its slots.
- `normal-map-*` writes `normal-map`, `normal-map:defaults:<field>` or `normal-map:zone:<regionId>`.

The whole texture overlaps any set holding pixels, so a resize or a texture replacement refuses every step that guards pixels. Pixel guards keep one byte copy of the guarded pixels per step, not one value per key.

## `pixelEdits`

```ts
type PixelEdits = ChangeSourceAdapter<DocumentCommand>;

function pixelEdits(document: ChangeSource<DocumentCommand>): PixelEdits;
```

The document as a history source, with the `receipts` a sync client writes the server's answers to. It is created once per document, so `PixelSyncClient`, `registerPixelHistory` and both canvas histories share it: an undo is sent with the `basis` of its step, and the server's answers reach the history.

## Behaviour

- A peer edit over a value a step would write back refuses that step; other steps stay undoable.
- A remote resize or texture replacement refuses the steps over pixels instead of clearing the history.
- A snapshot load refuses the steps whose values it changed.
- An undo or redo can be refused: the canvas's `undo()` and `redo()` then return `false`, and the history lists the step in `refused`.
