# AssetLoadBatch

## `AssetLoadBatch`

`AssetCoordinator.loadBatch(references, options?)` returns one loading
operation with its own progress and failure state.

```ts
interface AssetLoadBatch {
  readonly status: "loading" | "ready" | "failed";
  readonly completed: number;
  readonly total: number;
  readonly failures: readonly AssetLoadFailure[];
  readonly done: Promise<void>;
}
```

`total` is fixed when the batch is created. Duplicate asset IDs count once.
Assets already present in the shared store are included in `total` and start
as completed. An empty batch starts with the `"ready"` status.

Await `done` before synchronously reading every handle required by the
operation:

```ts
const batch = assets.loadBatch([
  modelReference,
  musicReference
]);

await batch.done;
```

## Progress

`options.onProgress` runs when a pending asset settles. Ready assets counted
at batch creation do not produce a progress callback.

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

The `status` field narrows access to `error`. If the progress callback throws,
`done` rejects with that value after the asset tasks settle. The callback error
is not added to `failures`.

## Failures and retries

The batch waits for every asset task. If one or more tasks fail, `done` rejects
with `AssetBatchLoadError`, `status` becomes `"failed"`, and `failures`
contains the failed records. A later batch retries assets left in the store's
`"failed"` state.

## Concurrent batches

Each batch owns its `completed`, `total`, `status`, and `failures` values.
Concurrent batches can contain the same reference. The batches observe the
same in-flight store promise and count its result independently.
