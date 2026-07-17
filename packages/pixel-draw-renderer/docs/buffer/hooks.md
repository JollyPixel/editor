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
  }
  | {
    action: "resized";
    metadata: {
      size: Vec2;
    };
  }
  | {
    action: "texture-replaced";
    metadata: {
      size: Vec2;
      /** Base64-encoded RGBA bytes. */
      pixels: string;
    };
  };

type PixelBufferHookAction = PixelBufferHookEvent["action"];

type PixelBufferHookListener = (event: PixelBufferHookEvent) => void;
```

A `"stroke"` event carries one color and a deduped list of pixel positions for an entire paint stroke (mouse-down to mouse-up) or a single `commitPixels` call, not one event per brush stamp. `"resized"` and `"texture-replaced"` fire from `CanvasManager.setTextureSize` and `CanvasManager.setTexture` respectively.
