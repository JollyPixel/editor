# Logger

`Systems.Logger` writes leveled messages filtered by namespace. Every
[World](world.md) owns one as `world.logger`; any other code can construct its
own.

```ts
import { Systems } from "@jolly-pixel/ecs";

const logger = new Systems.Logger({
  level: "debug",
  namespaces: ["boot.*"]
});
const boot = logger.child({ namespace: "boot" });

boot.debug("scene loaded", { scene: "Game" });
// [DEBUG] [boot] scene loaded { scene: "Game" }
```

## Options

```ts
type LogLevel = "void" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface LoggerOptions {
  /** @default "info" */
  level?: LogLevel;
  /** @default [] */
  namespaces?: string[];
  /** @default console */
  adapter?: ConsoleAdapter;
  listener?: (entry: LogEntry) => void;
}

interface LogEntry {
  readonly level: Exclude<LogLevel, "void">;
  readonly namespace: string;
  readonly message: string;
  readonly meta: Record<string, unknown> | undefined;
}
```

A message is written when its level is at least `level`. A `trace`, `debug`
or `info` message also needs its logger's namespace to match one of
`namespaces`; `warn`, `error` and `fatal` are written whatever the namespace.
With no namespaces, only warnings and errors are written; `"void"` silences
every level. Patterns use dots and match case: `"boot.*"` matches `boot` and
everything below it, `"*"` matches every namespace. Elsewhere a `*` segment
matches one level (`"boot.*.assets"`), `**` any number of levels, and `*` or
`?` inside a segment any characters or one.

`adapter` is described in [Adapters](../internals/adapters.md#console).
`listener` receives each written message after the adapter, unformatted, with
the namespace of the logger that wrote it. A listener that throws does not
reach the code that logged: the logger writes `log listener failed` with the
`error` to `adapter.error` instead.

The engine logs on children of `world.logger`:

- `ecs.world`: connect, start, stop and dispose.
- `ecs.scene-manager`: scene changes and teardown.
- `ecs.file-scene` and `ecs.scene-instance`: skipped actors, components,
  assets, prefabs and signal connections of a scene file.
- `ecs.behavior`: unregistered behaviors and missing behavior members.
- `scene.<name>`: `scene.logger` of the scene named `<name>`, with each `.`
  of the name replaced by `-`.

## Children

```ts
child(options: { namespace: string }): Logger;
```

A child appends its namespace to its parent's (`boot` then `scene` gives
`boot.scene`) and shares the parent's level, patterns and adapter, so
assigning `level`, `enableNamespace` and `disableNamespace` on any logger of the tree
apply to all of them.

## Writing

```ts
trace(msg: string, meta?: Record<string, unknown>): void;
debug(msg: string, meta?: Record<string, unknown>): void;
info(msg: string, meta?: Record<string, unknown>): void;
warn(msg: string, meta?: Record<string, unknown>): void;
error(msg: string, meta?: Record<string, unknown>): void;
fatal(msg: string, meta?: Record<string, unknown>): void;
```

`trace`, `debug` and `info` go to `adapter.log`, `warn` to `adapter.warn`,
`error` and `fatal` to `adapter.error`.

## Steps

```ts
step<T>(
  name: string,
  run: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T>;
```

Runs `run` and returns its result. It writes `<name> started` at debug level
before awaiting, `<name> done` with `ms` once `run` resolves, and
`<name> failed` with `error` at error level when it rejects, then rethrows.
`meta` is added to all three. A step that never settles leaves its
`started` line as the last one, which names the operation a hang is waiting
on.

A step that resolves also records a `performance.measure()` named
`<namespace>:<name>` (`root:<name>` on the root logger), whatever the level
and namespaces. The measures show in the DevTools Performance panel and can
be read with `performance.getEntriesByType("measure")`.

```ts
const workspace = await logger.step("scene", () => scene.ready);
// [DEBUG] [editor] scene started
// [DEBUG] [editor] scene done { ms: 12 }
```
