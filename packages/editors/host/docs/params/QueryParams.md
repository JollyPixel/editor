# QueryParams

Declares an editor's query-string parameters once and reads them as a typed
object.

```ts
const PARAMS = new QueryParams((query) => {
  return {
    empty: query.flag("empty"),
    addDelay: query.number("add-delay")
  };
});

PARAMS.read("?empty&add-delay=30");
// { empty: true, addDelay: 30 }
```

## QueryParams

```ts
class QueryParams<T> {
  constructor(parse: (query: QueryString) => T);
  read(search?: string): T; // defaults to location.search
}

class QueryString {
  flag(name: string): boolean;
  number(name: string): number | undefined;
  number(name: string, fallback: number): number;
  string(name: string): string | undefined;
}
```

- `flag` is `true` when the parameter is present, whatever its value.
- `number` returns `fallback` when the parameter is absent or not a number.
- `string` returns the raw value.

## Host parameters

Every editor page reads these, so an editor's own set leaves them out.
`HOST_PARAMS.read()` returns all of them but `debug`.

- `max-fps`: frame-rate cap, over the editor's own
  ([`EditorRuntime.load`](../runtime/EditorRuntime.md#methods)).
- `samples`: a non-negative integer, read by
  [`EditorRuntime.samples`](../runtime/EditorRuntime.md#properties).
- `render`: `continuous` or `on-demand`, see
  [`EditorRuntime.create`](../runtime/EditorRuntime.md#methods).
- `gpu-time`: shows the GPU time of each frame in the metrics panel.
- `username`: skips the username prompt in [dev](../boot/bootStandalone.md#options).
- `offline`: opens [offline mode](../boot/bootStandalone.md#startup); a value
  names the offline data.
- `debug`: enables [debug logging](../boot/bootStandalone.md#debug-logging).
