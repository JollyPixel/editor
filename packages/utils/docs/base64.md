# Base64

Encode and decode bytes as base64 text. Each function uses
`Uint8Array.prototype.toBase64` / `Uint8Array.fromBase64` when the runtime has
them, then Node.js `Buffer`, then `btoa` / `atob`.

```ts
import {
  decodeBase64,
  encodeBase64,
  encodeBase64Url
} from "@jolly-pixel/utils";
```

## `encodeBase64()`

```ts
function encodeBase64(bytes: Uint8Array): string;
```

Standard alphabet with `=` padding. Only the view's bytes are encoded, not the
whole underlying buffer.

## `encodeBase64Url()`

```ts
function encodeBase64Url(bytes: Uint8Array): string;
```

The URL-safe alphabet (`-` and `_`) with the padding removed, for tokens in
URLs, cookies or WebSocket protocol names.

## `decodeBase64()`

```ts
function decodeBase64(text: string): Uint8Array<ArrayBuffer> | null;
```

Bytes from padded, standard-alphabet base64. Returns `null` when the length is
not a multiple of four or the text holds any other character, including
whitespace and the URL-safe `-` and `_`.

```ts
decodeBase64("AQID");  // Uint8Array [1, 2, 3]
decodeBase64("AQI");   // null
```
