---
"@jolly-pixel/pixel-draw.renderer": major
---

One reversible `PixelCommand` model shared by history, remote apply and `PixelDocumentState`; `buffer-updated`/`onBufferUpdated` become the `command` event, document intents are `paint*`/`record*`, canvas forwarders are removed.
UV regions split into stacked/net/free layouts: `withRect` becomes `movedTo`, slot parameters take `UVSlot | null`, only active slots are targeted, `UVRegionCollection` is removed; `NormalMapConfig.from` now validates its data.
Selection edits apply through the document, strokes keep their starting color, overlays paint in fixed layers through the new `ScreenProjection` viewport methods (`mouseCanvasPosition` removed).
