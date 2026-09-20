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
