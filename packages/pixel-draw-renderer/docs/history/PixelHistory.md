# Pixel history

Undo and redo run on a [`CommandHistory`](../../../history/docs/CommandHistory.md) from `@jolly-pixel/history`. A [`PixelDocument`](../PixelDocument.md) is a history source: it emits a `change` for each local edit, with the commands that undo it, and replays them through `applyStep`. The history refuses a step a peer changed since, and reports it.

## On a canvas

[`PixelArtCanvasOptions.history`](../PixelArtCanvasOptions.md#history) picks the history:

```ts
type PixelArtCanvasHistory = StandalonePixelHistory | PixelHistoryOwner;

interface StandalonePixelHistory {
  enabled?: boolean;
  limit?: number;
}

interface PixelHistoryOwner<TScope extends string = string> {
  history: CommandHistory<TScope>;
  scope: TScope;
}
```

- `{ enabled: true, limit }` uses the document's own history, with one `pixels` scope, `limit` steps deep (10 by default). The first canvas creates it; every canvas on the document shares it, and it lives as long as the document.
- `{ history, scope }` drives `scope` of a history the host owns, next to other documents' steps. The host registers the document with `registerPixelHistory`; the canvas only adds its selection to the steps. Closing the canvas leaves the document registered: its pixel steps still undo, and steps holding its selection are refused as `closed`.

Without either, the canvas records nothing.

A selection move, transform or delete records the selection footprints with the pixels in one step. Undo and redo restore the selection after the pixels, in Select mode only, even when the undo runs through the shared history instead of the canvas.

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

`registerPixelHistory` registers the document in `history` and files each `document.batch()` as one step of `scope`; it returns the release. A document can be registered in several histories: each files the batch as one step. `pixelHistoryRegistration` alone files every local change of the document in `scope` and labels it by action ("Paint", "Resize texture", "Move UV"...). `pixelHistoryKeys` names what each command writes and what a step must find unchanged, as a `PixelKeySet` of pixels, or the whole texture, and named keys:

| Commands | Keys |
|---|---|
| `stroke`, `select-edit` | their pixels |
| `global-fill`, `resized`, `texture-replaced` | the whole texture; a step undoing them guards every pixel |
| `palette-color-changed` | `palette:<index>` |
| `uv-region-*` | the region and its slots |
| `normal-map-*` | `normal-map`, `normal-map:defaults:<field>`, `normal-map:zone:<regionId>` |

The whole texture overlaps any set holding pixels, so a resize or a texture replacement refuses every step that guards pixels. Pixel guards keep one byte copy of the guarded pixels per step, not one value per key.

## Behaviour

- A peer edit over a value a step would write back refuses that step; other steps stay undoable.
- A remote resize or texture replacement refuses the steps over pixels instead of clearing the history.
- A snapshot load refuses the steps whose values it changed.
- An undo or redo can be refused: the canvas's `undo()` and `redo()` then return `false`, and `onHistoryChange` lists the step in `refused`.
