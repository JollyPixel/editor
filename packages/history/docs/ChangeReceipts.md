# ChangeReceipts

The server's answers about a history source's local changes. The sync client writes them; [`CommandHistory`](./CommandHistory.md) reads them. See [receipts and basis](./guides/collaborative-undo.md#receipts-and-basis).

`@jolly-pixel/network`'s `CommandSync` attaches the receipts passed as its `receipts` option and answers the commands it sent with `sendChange`.

```ts
const detach = document.receipts.attach();

document.receipts.confirm(change, 12);
document.receipts.refuse(change);
document.receipts.discard();

detach();
```

## Properties

### attached: boolean

`true` while a sync client holds `attach()`'s detach. A local change waits for a receipt only while attached.

## Methods

### attach(): () => void

Returns the detach. Throws when already attached.

### confirm(change, version): void

Emits `confirmed`. `version` is `number | undefined`.

### refuse(change): void

Emits `refused`.

### discard(): void

Emits `discarded`: every change still waiting is lost.

## Events

### confirmed

```ts
(change: TChange, version: number | undefined) => void
```

### refused

```ts
(change: TChange) => void
```

### discarded

```ts
() => void
```
