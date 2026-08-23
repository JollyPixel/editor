# AssetLoadBatch

`AssetLoadBatch` tracks one loading operation over a fixed set of asset
references.

## API

```ts
type AssetLoadBatchStatus =
  | "loading"
  | "ready"
  | "failed";

interface AssetLoadBatchOptions {
  onProgress?: (progress: AssetLoadProgress) => void;
}

interface AssetLoadBatch {
  readonly status: AssetLoadBatchStatus;
  readonly completed: number;
  readonly total: number;
  readonly failures: readonly AssetLoadFailure[];
  readonly done: Promise<void>;
}
```

`AssetCoordinator.loadBatch()` snapshots its input. Duplicate IDs count once.
Ready assets are included in `total` and the initial `completed` count. An empty
batch starts ready with both counts set to zero.

Await `done` before synchronously reading every asset required by the
operation:

```ts
const batch = assets.loadBatch([
  modelReference,
  musicReference
]);

await batch.done;
```

## Progress

```ts
type AssetLoadProgress =
  | {
    readonly completed: number;
    readonly total: number;
    readonly record: AssetRecord;
    readonly status: "ready";
  }
  | {
    readonly completed: number;
    readonly total: number;
    readonly record: AssetRecord;
    readonly status: "failed";
    readonly error: unknown;
  };
```

`onProgress` runs when a pending asset settles. Assets that were ready when the
batch started do not produce callbacks. Completion order follows task
settlement order.

The `status` field narrows access to `error`. If the callback throws, the batch
waits for every task and then rejects `done` with that value. Callback errors
do not appear in `failures`.

## Failures and retries

```ts
interface AssetLoadFailure {
  readonly record: AssetRecord;
  readonly error: unknown;
}
```

The batch waits for every task. If at least one asset fails, `done` rejects with
`AssetBatchLoadError`, `status` becomes `"failed"`, and `failures` contains each
failed record and rejection value.

A later batch retries assets left in the store's failed state.

## Concurrent batches

Each batch owns its status, counts, and failures. Concurrent batches can
contain the same reference. They observe the same in-flight store promise and
count its result independently.
