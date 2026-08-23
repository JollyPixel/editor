// Import Internal Dependencies
import { Input } from "../src/index.ts";
import type {
  CanvasAdapter,
  DocumentAdapter,
  EventTargetListener,
  NavigatorAdapter,
  WindowAdapter
} from "../src/adapters/index.ts";

/**
 * Headless adapters mirroring `test/mocks`, minus the `node:test` mock
 * instrumentation (which allocates a call record per invocation and would
 * pollute the very allocation counts these benchmarks measure).
 *
 * `dispatch` replaces the browser event loop: it invokes the listeners the
 * device registered through `connect()`, so the DOM-facing hot paths are
 * measurable without a DOM.
 */
export class BenchEventTarget {
  #listeners = new Map<string, Set<EventTargetListener>>();

  addEventListener(
    type: string,
    listener: EventTargetListener
  ): void {
    let set = this.#listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(
    type: string,
    listener: EventTargetListener
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatch(
    type: string,
    event: unknown
  ): void {
    const set = this.#listeners.get(type);
    if (set === undefined) {
      return;
    }

    for (const listener of set) {
      listener(event);
    }
  }
}

export class BenchCanvasAdapter extends BenchEventTarget implements CanvasAdapter {
  clientWidth = 1920;
  clientHeight = 1080;
  style = { cursor: "auto" };

  /**
   * Layout reads cannot be timed outside a browser, so they are counted
   * instead: "rect reads per event" is the metric that matters.
   */
  boundingClientRectCalls = 0;

  #rect = {
    left: 24,
    top: 64,
    right: 1944,
    bottom: 1144,
    width: 1920,
    height: 1080,
    x: 24,
    y: 64
  };

  getBoundingClientRect() {
    this.boundingClientRectCalls++;

    return this.#rect;
  }

  requestFullscreen(): void {
    // no-op
  }

  requestPointerLock(): Promise<void> {
    return Promise.resolve();
  }

  focus(): void {
    // no-op
  }
}

export class BenchDocumentAdapter extends BenchEventTarget implements DocumentAdapter {
  fullscreenElement: unknown = null;
  pointerLockElement: unknown = null;

  exitFullscreen(): void {
    this.fullscreenElement = null;
  }

  exitPointerLock(): void {
    this.pointerLockElement = null;
  }
}

export class BenchNavigatorAdapter implements NavigatorAdapter {
  gamepads: (globalThis.Gamepad | null)[] = [null, null, null, null];

  /**
   * Browsers hand back a fresh snapshot array on every call. Reproducing that
   * here keeps the gamepad benchmark honest about the allocation it triggers.
   */
  allocateSnapshot = true;

  getGamepads(): (globalThis.Gamepad | null)[] {
    return this.allocateSnapshot ? this.gamepads.slice() : this.gamepads;
  }

  vibrate(): boolean {
    return true;
  }
}

export class BenchWindowAdapter extends BenchEventTarget implements WindowAdapter {
  onbeforeunload: ((this: Window, ev: BeforeUnloadEvent) => any) | null = null;
  navigator: BenchNavigatorAdapter = new BenchNavigatorAdapter();
}

export interface BenchAdapters {
  canvas: BenchCanvasAdapter;
  document: BenchDocumentAdapter;
  window: BenchWindowAdapter;
}

export function createAdapters(): BenchAdapters {
  return {
    canvas: new BenchCanvasAdapter(),
    document: new BenchDocumentAdapter(),
    window: new BenchWindowAdapter()
  };
}

export interface BenchInput extends BenchAdapters {
  input: Input;
}

/**
 * A fully connected `Input`, wired to headless adapters on every seam.
 */
export function createInput(): BenchInput {
  const adapters = createAdapters();
  const input = new Input(adapters.canvas, {
    windowAdapter: adapters.window,
    documentAdapter: adapters.document
  });
  input.connect();

  return { input, ...adapters };
}

export function createGamepadSnapshot(
  index = 0
): globalThis.Gamepad {
  return {
    id: "bench-gamepad",
    index,
    connected: true,
    timestamp: 0,
    mapping: "standard",
    buttons: Array.from({ length: 16 }, () => {
      return { pressed: false, touched: false, value: 0 };
    }),
    axes: [0, 0, 0, 0],
    vibrationActuator: null
  } as unknown as globalThis.Gamepad;
}

/**
 * `offsetX`/`offsetY` are always present on a real `MouseEvent`, so they are
 * present here too — without them the benchmark would measure `Mouse`'s
 * `getBoundingClientRect()` fallback rather than the path a browser takes.
 * Pass `omitOffsets` to exercise that fallback deliberately.
 */
export function mouseEvent(
  target: unknown,
  overrides: Record<string, unknown> = {}
): MouseEvent {
  const clientX = (overrides.clientX as number) ?? 960;
  const clientY = (overrides.clientY as number) ?? 540;
  const { omitOffsets, ...rest } = overrides;

  return {
    target,
    button: 0,
    buttons: 0,
    clientX,
    clientY,
    offsetX: omitOffsets === true ? undefined : clientX - 24,
    offsetY: omitOffsets === true ? undefined : clientY - 64,
    movementX: 0,
    movementY: 0,
    preventDefault: noop,
    ...rest
  } as unknown as MouseEvent;
}

export function wheelEvent(
  target: unknown,
  overrides: Record<string, unknown> = {}
): WheelEvent {
  return {
    target,
    deltaMode: 0,
    DOM_DELTA_PIXEL: 0,
    DOM_DELTA_LINE: 1,
    DOM_DELTA_PAGE: 2,
    deltaX: 0,
    deltaY: -120,
    wheelDeltaX: 0,
    wheelDeltaY: 120,
    preventDefault: noop,
    ...overrides
  } as unknown as WheelEvent;
}

export function keyboardEvent(
  code: string,
  overrides: Record<string, unknown> = {}
): KeyboardEvent {
  return {
    code,
    key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code,
    target: null,
    preventDefault: noop,
    ...overrides
  } as unknown as KeyboardEvent;
}

export function touchEvent(
  target: unknown,
  identifiers: number[],
  overrides: Record<string, unknown> = {}
): TouchEvent {
  const changedTouches = identifiers.map((identifier) => {
    return {
      identifier,
      clientX: 400 + (identifier * 40),
      clientY: 300 + (identifier * 40)
    };
  });

  return {
    target,
    changedTouches,
    preventDefault: noop,
    ...overrides
  } as unknown as TouchEvent;
}

function noop(): void {
  // deliberately empty
}
