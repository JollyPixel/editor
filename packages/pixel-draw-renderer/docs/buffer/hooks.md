# buffer/hooks

Type-only module describing the shape of `CanvasManager`'s local-mutation hook (`onBufferUpdated` / `CanvasManagerOptions.onBufferUpdated`, see [CanvasManager.md](../CanvasManager.md)). This is the vocabulary the [network layer](../network/index.md) is built on: every `PixelBufferHookEvent` is also a valid `PixelNetworkEvent` payload once stamped with routing metadata.

## Types

```ts
type PixelBufferHookEvent =
  | {
    action: "stroke";
    metadata: {
      color: RGBA;
      positions: Vec2[];
    };
    originTimestamp?: number;
  }
  | {
    action: "resized";
    metadata: {
      size: Vec2;
    };
    originTimestamp?: number;
  }
  | {
    action: "texture-replaced";
    metadata: {
      size: Vec2;
      /** Base64-encoded RGBA bytes. */
      pixels: string;
    };
    originTimestamp?: number;
  };

type PixelBufferHookAction = PixelBufferHookEvent["action"];

type PixelBufferHookListener = (event: PixelBufferHookEvent) => void;
```

A `"stroke"` event carries one color and a deduped list of pixel positions for an entire paint stroke (mouse-down to mouse-up) or a single `commitPixels` call, not one event per brush stamp. `"resized"` and `"texture-replaced"` fire from `CanvasManager.setTextureSize` and `CanvasManager.setTexture` respectively.

`originTimestamp` is only set on the events `CanvasManager.undo()`/`redo()` emit (see [history/HistoryStack.md](../history/HistoryStack.md)): it carries the *original* edit's timestamp instead of "now". `PixelSyncSession` uses it as the outgoing command's `timestamp` so the server's per-pixel [conflict resolver](../network/ConflictResolver.md) re-races the replay fairly against whatever a peer did since the original edit, rather than always winning by virtue of being freshly stamped. It's stripped before the command is sent — peers never see `originTimestamp` itself, only the `timestamp` it was folded into.
