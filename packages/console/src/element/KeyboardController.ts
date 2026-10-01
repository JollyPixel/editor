// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  isToggleShortcut,
  type ShortcutInput
} from "../toggleShortcut.ts";

export interface KeyInput extends ShortcutInput {
  isComposing?: boolean;
  preventDefault(): void;
}

export interface KeyState {
  highlight: number;
  itemCount: number;
  browsingHistory: boolean;
  inlineCompletion: boolean;
  hasText: boolean;
  hasHistory: boolean;
  highlightRuns: boolean;
}

export type ConsoleKeyAction =
  | "close"
  | "submit"
  | "accept"
  | "complete"
  | "history-previous"
  | "history-next"
  | "highlight-previous"
  | "highlight-next";

export interface KeyHint {
  keys: string;
  action: string;
}

export interface KeyboardControllerOptions {
  state: () => KeyState;
  act: (action: ConsoleKeyAction) => void;
  toggle: () => boolean;
}

export class KeyboardController implements ReactiveController {
  #options: KeyboardControllerOptions;

  constructor(
    host: ReactiveControllerHost,
    options: KeyboardControllerOptions
  ) {
    this.#options = options;
    host.addController(this);
  }

  get hints(): KeyHint[] {
    const state = this.#options.state();
    const hints: KeyHint[] = [];
    if (state.itemCount > 0) {
      hints.push({ keys: "↑↓", action: "navigate" });
    }
    else if (state.hasHistory) {
      hints.push({ keys: "↑↓", action: "history" });
    }

    if (state.highlight >= 0) {
      hints.push({ keys: "↵", action: state.highlightRuns ? "run" : "insert" });
    }
    else if (state.hasText) {
      hints.push({ keys: "↵", action: "run" });
    }

    if (state.inlineCompletion || (state.hasText && state.itemCount > 0)) {
      hints.push({ keys: "Tab", action: "complete" });
    }
    hints.push({ keys: "Esc", action: "close" });

    return hints;
  }

  hostConnected(): void {
    window.addEventListener(
      "keydown",
      this.onWindowKeyDown,
      true
    );
  }

  hostDisconnected(): void {
    window.removeEventListener(
      "keydown",
      this.onWindowKeyDown,
      true
    );
  }

  readonly onWindowKeyDown = (
    event: KeyInput
  ): void => {
    if (
      isToggleShortcut(event) &&
      this.#options.toggle()
    ) {
      event.preventDefault();
    }
  };

  readonly onKeyDown = (
    event: KeyInput
  ): void => {
    const action = this.#resolve(event, this.#options.state());
    if (action !== null) {
      event.preventDefault();
      this.#options.act(action);
    }
  };

  #resolve(
    event: KeyInput,
    state: KeyState
  ): ConsoleKeyAction | null {
    if (
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return null;
    }

    switch (event.key) {
      case "Escape":
        return "close";
      case "Enter":
        if (event.shiftKey) {
          return null;
        }

        return state.highlight >= 0 ? "accept" : "submit";
      case "Tab":
        return event.shiftKey ? null : "complete";
      case "ArrowUp":
        return state.browsingHistory || state.highlight < 0 ?
          "history-previous" :
          "highlight-previous";
      case "ArrowDown":
        if (state.browsingHistory) {
          return "history-next";
        }

        return state.itemCount > 0 ? "highlight-next" : null;
      case "ArrowRight":
        return state.inlineCompletion && !event.shiftKey ? "complete" : null;
      default:
        return null;
    }
  }
}
