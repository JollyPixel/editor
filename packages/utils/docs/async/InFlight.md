# InFlight

Shares one run of a piece of async work between callers that ask for the same
key while it is pending. Once the work settles, the key is forgotten, so the
next call runs it again. It caches nothing.

```ts
import { InFlight } from "@jolly-pixel/utils";

const loads = new InFlight<Uint8Array>();

const [first, second] = await Promise.all([
  loads.run("tiles.png", () => fetchBytes("tiles.png")),
  loads.run("tiles.png", () => fetchBytes("tiles.png"))
]);
// one fetch, both callers get its result
```

```ts
class InFlight<T> {
  run(key: string, work: () => Promise<T>): Promise<T>;
}
```

`run` returns the pending promise for `key` when there is one, and otherwise
starts `work`. A rejection reaches every caller that joined the run.
