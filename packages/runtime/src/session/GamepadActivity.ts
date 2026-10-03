// Import Third-party Dependencies
import type { Input } from "@jolly-pixel/engine";
import type { GameLoop } from "@jolly-pixel/loop";

export type GamepadPoller = Pick<
  Input["gamepad"],
  "connectedGamepads" | "wasActive" | "sample"
>;

export type GamepadActivityView = Pick<
  Window,
  "addEventListener" | "requestAnimationFrame" | "cancelAnimationFrame"
>;

export class GamepadActivity {
  #gamepad: GamepadPoller;
  #view: GamepadActivityView;
  #onActivity: () => void;
  #abort = new AbortController();
  #unsubscribes: Array<() => void>;
  #frame: number | null = null;

  constructor(
    gamepad: GamepadPoller,
    loop: Pick<GameLoop, "subscribe">,
    view: GamepadActivityView,
    onActivity: () => void
  ) {
    this.#gamepad = gamepad;
    this.#view = view;
    this.#onActivity = onActivity;

    view.addEventListener(
      "gamepadconnected",
      onActivity,
      { signal: this.#abort.signal }
    );
    this.#unsubscribes = [
      loop.subscribe("sleep", () => this.#schedule()),
      loop.subscribe("wake", () => this.#cancel()),
      loop.subscribe("stop", () => this.#cancel())
    ];
  }

  dispose(): void {
    this.#abort.abort();
    this.#cancel();

    for (const unsubscribe of this.#unsubscribes.splice(0)) {
      unsubscribe();
    }
  }

  #schedule(): void {
    this.#frame ??= this.#view.requestAnimationFrame(
      this.#poll
    );
  }

  #cancel(): void {
    if (this.#frame !== null) {
      this.#view.cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }

  readonly #poll = (): void => {
    this.#frame = null;
    if (this.#gamepad.connectedGamepads <= 0) {
      return;
    }

    this.#gamepad.sample();
    if (this.#gamepad.wasActive) {
      this.#onActivity();

      return;
    }

    this.#schedule();
  };
}
