# Hashes

## `sha256Hex()`

```ts
function sha256Hex(data: Uint8Array): Promise<string>;
```

The SHA-256 digest of `data` as 64 lowercase hex characters, computed with
Web Crypto (`crypto.subtle`), so it runs in browsers and Node.js alike.

```ts
import { sha256Hex } from "@jolly-pixel/utils";

await sha256Hex(new TextEncoder().encode("hello"));
// "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
```
