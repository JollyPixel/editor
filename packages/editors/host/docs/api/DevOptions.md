# DevOptions

`DevOptions` reads typed development switches from the query string.

## API

```ts
type DevOptionParser<T> = (value: string | null) => T;

type DevOptionSchema<T> = {
  [K in keyof T]: DevOptionParser<T[K]>;
};

class DevOptions<T> {
  static flag(): DevOptionParser<boolean>;
  static number(): DevOptionParser<number | undefined>;
  static number(fallback: number): DevOptionParser<number>;
  static string(): DevOptionParser<string | undefined>;

  readonly schema: DevOptionSchema<T>;

  constructor(schema: DevOptionSchema<T>);

  read(search?: string): T;
}

function exposeDebugHandle(name: string, handle: unknown): () => void;
```

Each schema key reads the query parameter of its kebab-case name: `maxFps`
reads `max-fps`. `read` defaults to `location.search`.

| Parser | Absent | Present |
|---|---|---|
| `flag()` | `false` | `true`, whatever the value |
| `number(fallback?)` | `fallback` | the number, or `fallback` when it does not parse |
| `string()` | `undefined` | the raw value |

```ts
const options = new DevOptions({
  offline: DevOptions.flag(),
  maxFps: DevOptions.number()
}).read("?offline&max-fps=30");
// { offline: true, maxFps: 30 }
```

`exposeDebugHandle` sets `globalThis[name]` and returns a function that
deletes it, unless another value replaced it since.
