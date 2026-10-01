# Logger

`Systems.Logger` writes leveled messages filtered by namespace. Every
[World](world.md) owns one as `world.logger`; any other code can construct its
own.

```ts
import { Systems } from "@jolly-pixel/engine";

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
}
```

A message is written when its level is at least `level` and its logger's
namespace matches one of `namespaces`. With no namespaces, nothing is written;
`"void"` silences every level. Patterns use dots: `"boot.*"` matches `boot`
and everything below it, `"*"` matches every namespace. `adapter` is described
in [Adapters](../internals/adapters.md#console).

## Children

```ts
child(options: { namespace: string }): Logger;
```

A child appends its namespace to its parent's (`boot` then `scene` gives
`boot.scene`) and shares the parent's level, patterns and adapter, so
`setLevel`, `enableNamespace` and `disableNamespace` on any logger of the tree
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

```ts
const workspace = await logger.step("scene", () => scene.ready);
// [DEBUG] [editor] scene started
// [DEBUG] [editor] scene done { ms: 12 }
```
