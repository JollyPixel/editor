# Adapters

Thin interfaces that abstract browser globals behind injectable
contracts, so engine code can be unit tested with mocks.

Input-related adapters (`window`, `document`, `navigator`, `canvas`)
live in `@jolly-pixel/controls`.

## Console

Used by `Systems.Logger` (`adapter` option) and `BehaviorInitializer`
(`consoleAdapter` option).

```ts
interface ConsoleAdapter {
  log(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
}
```

Default: the global `console`.

## Globals

Used by `World` (`globalsAdapter` option) to publish the world instance.

```ts
interface GlobalsAdapter {
  setGame(instance: World<any, any>): void;
}
```

Default: `BrowserGlobalsAdapter` (assigns `globalThis.game`).
