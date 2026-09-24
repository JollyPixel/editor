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

| Reader | Absent | Present |
|---|---|---|
| `flag(name)` | `false` | `true`, whatever the value |
| `number(name, fallback?)` | `fallback` | the number, or `fallback` when it does not parse |
| `string(name)` | `undefined` | the raw value |

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
}

HOST_PARAMS.read("?max-fps=10&samples=0&username=Ada&offline");
// { maxFps: 10, samples: 0, username: "Ada", offline: true, workspace: undefined }
```

| Parameter | Field | Accepted values | Used by |
|---|---|---|---|
| `max-fps` | `maxFps` | a positive number | [`EditorRuntime.load`](./EditorRuntime.md#loading-a-scene) |
| `samples` | `samples` | a non-negative integer | [`EditorRuntime.samples`](./EditorRuntime.md#properties) |
| `username` | `username` | a non-blank string, trimmed | [`rememberQueryUsername`](./EditorSession.md#identity), in dev only |
| `offline` | `offline` | present, whatever the value | [`bootStandalone`](./mountStandalone.md#offline-fallback) |
| `workspace` | `workspace` | a non-blank string, trimmed | [`bootStandalone`](./mountStandalone.md#offline-fallback) |

Any other value reads as `undefined`, and an absent `offline` as `false`.
