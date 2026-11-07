# TaskChain

Runs async tasks one at a time, in the order they were queued. A rejected task
does not stop the tasks queued after it.

```ts
import { TaskChain } from "@jolly-pixel/utils";

const writes = new TaskChain();

await Promise.all([
  writes.run(() => writeFile(path, first)),
  writes.run(() => writeFile(path, second))
]);
// second starts once first has settled
```

```ts
class TaskChain {
  get idle(): boolean;

  run<TResult>(task: () => Promise<TResult>): Promise<TResult>;
  settled(): Promise<void>;
}
```

- `run` queues `task` and resolves or rejects with its own result.
- `idle` is `true` once every queued task has settled.
- `settled` resolves when the tasks queued so far have settled. It never
  rejects and queues nothing.
