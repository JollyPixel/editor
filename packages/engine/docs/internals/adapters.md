## Adapters

Thin interfaces that abstract Browser and Three.js APIs behind
injectable contracts. This enables unit testing with mocks and
decouples engine code from `window`, `document`, `navigator`,
and `canvas` globals.

Each adapter has a matching `Browser*Adapter` class that delegates
to the real browser API and is used as the default implementation.

### EventTarget

Base interface shared by all adapters that need event listeners.

```ts
type EventTargetListener = (...args: any[]) => void | boolean;

interface EventTargetAdapter {
  addEventListener(
    type: string,
    listener: EventTargetListener,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventTargetListener,
    options?: boolean | AddEventListenerOptions
  ): void;
}
```

### Canvas

```ts
interface CanvasAdapter extends EventTargetAdapter {
  requestFullscreen(): void;
  requestPointerLock(options?: PointerLockOptions): Promise<void>;
  focus(options?: FocusOptions): void;
}
```

### Document

```ts
interface DocumentAdapter extends EventTargetAdapter {
  fullscreenElement?: Element | null;
  pointerLockElement?: Element | null;

  exitFullscreen(): void;
  exitPointerLock(): void;
}
```

Default: `BrowserDocumentAdapter` (delegates to `document`).

### Window

```ts
interface WindowAdapter extends EventTargetAdapter {
  onbeforeunload?: ((this: Window, ev: BeforeUnloadEvent) => any) | null;
  navigator: NavigatorAdapter;
}
```

Default: `BrowserWindowAdapter` (delegates to `window`).

### Navigator

```ts
interface NavigatorAdapter {
  getGamepads(): (Gamepad | null)[];
  vibrate(pattern: VibratePattern): boolean;
}
```

Default: `BrowserNavigatorAdapter` (delegates to `navigator`).

### Console

```ts
interface ConsoleAdapter {
  log(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
}
```
