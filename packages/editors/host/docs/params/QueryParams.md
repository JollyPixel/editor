# QueryParams

Declares an editor's query-string parameters once and reads them as a typed
object.

```ts
const PARAMS = new QueryParams((query) => {
  return {
    offline: query.flag("offline"),
    maxFps: query.number("max-fps")
  };
});

PARAMS.read("?offline&max-fps=30");
// { offline: true, maxFps: 30 }
```

## Constructor

```ts
class QueryParams<T> {
  constructor(parse: (query: QueryString) => T);

  read(search?: string): T;
}
```

`T` is inferred from `parse`. `search` defaults to `location.search`.

## Readers

```ts
class QueryString {
  constructor(search?: string);

  flag(name: string): boolean;
  number(name: string): number | undefined;
  number(name: string, fallback: number): number;
  string(name: string): string | undefined;
}
```

- `flag(name)`: `true` when present, whatever the value.
- `number(name, fallback?)`: the number, or `fallback` when absent or not a
  number.
- `string(name)`: the raw value, `undefined` when absent.

## Host parameters

`HOST_PARAMS` reads the parameters every editor shares, so an editor's own
set leaves them out.

```ts
interface HostParams {
  maxFps: number | undefined;
  samples: number | undefined;
  username: string | undefined;
  offline: boolean;
  workspace: string | undefined;
  render: "continuous" | "on-demand" | undefined;
}

HOST_PARAMS.read("?max-fps=10&samples=0&username=Ada&offline");
// {
//   maxFps: 10, samples: 0, username: "Ada", offline: true,
//   workspace: undefined, render: undefined
// }
```

- `max-fps`: a positive number, the cap of
  [`EditorRuntime.load`](../runtime/EditorRuntime.md#loading-a-scene).
- `samples`: a non-negative integer, read by
  [`EditorRuntime.samples`](../runtime/EditorRuntime.md#properties).
- `username`: stored by [`rememberQueryUsername`](../session/EditorSession.md#identity)
  in dev.
- `offline` and `workspace`: open the
  [offline workspace](../editor/bootStandalone.md#fallback).
- `render`: `continuous` or `on-demand`, see
  [`EditorRuntime.create`](../runtime/EditorRuntime.md#creation).

Strings are trimmed and must not be blank. Any other value reads as
`undefined`, and an absent `offline` as `false`.

`offlineWorkspaceQuery(workspace)` writes the `offline` and `workspace`
parameters, for a shell that opens editor pages on its own offline workspace:

```ts
new URLSearchParams(offlineWorkspaceQuery("studio")).toString();
// "offline=&workspace=studio"
```
