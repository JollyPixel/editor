# PixelWorld

Headless, multi-buffer registry. Used by [`PixelSyncServer`](./PixelSyncServer.md) as the authoritative store for every buffer (texture) shared in a session. Has no DOM/Canvas2D dependency and runs in Node.js / Deno / Bun.

Each registered [`PixelBuffer`](../buffer/PixelBuffer.md) also holds its own UV regions (see [uv/UVMap.md](../uv/UVMap.md)) — there is no separate "UV world".

## Types

```ts
new PixelWorld()
```

No constructor options; buffers are added individually via `addBuffer`.

## Methods

### `addBuffer`

```ts
addBuffer(bufferId: string, options: PixelBufferOptions): PixelBuffer
```

Creates and registers a new [`PixelBuffer`](../buffer/PixelBuffer.md) under `bufferId`. Throws if `bufferId` already exists.

---

### `removeBuffer`

```ts
removeBuffer(bufferId: string): void
```

---

### `getBuffer`

```ts
getBuffer(bufferId: string): PixelBuffer | undefined
```

---

### `hasBuffer`

```ts
hasBuffer(bufferId: string): boolean
```

---

### `getBufferIds`

```ts
getBufferIds(): IterableIterator<string>
```
