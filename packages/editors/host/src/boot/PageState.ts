// Import Internal Dependencies
import {
  EDITOR_STATE_ATTRIBUTE,
  type EditorState
} from "../shell/EditorState.ts";
import { LoadingBar } from "../ui/LoadingBar.ts";

export type EditorStateListener = (state: EditorState) => void;

export class PageState {
  #current: EditorState = "booting";
  #bar: LoadingBar | null = null;
  #listeners = new Set<EditorStateListener>();

  show(
    state: EditorState
  ): void {
    this.#current = state;
    document.documentElement.setAttribute(EDITOR_STATE_ATTRIBUTE, state);
    this.#showBar(state);
    for (const listener of this.#listeners) {
      listener(state);
    }
  }

  follow(
    listener: EditorStateListener,
    signal: AbortSignal
  ): void {
    if (signal.aborted) {
      return;
    }

    this.#listeners.add(listener);
    signal.addEventListener(
      "abort",
      () => this.#listeners.delete(listener),
      { once: true }
    );
    listener(this.#current);
  }

  dispose(): void {
    this.#bar?.remove();
    this.#bar = null;
  }

  #showBar(
    state: EditorState
  ): void {
    const switching = state === "switching";
    const loading = switching || state === "booting";
    if (this.#bar === null) {
      if (!loading) {
        return;
      }
      this.#bar = new LoadingBar();
      document.body.append(this.#bar);
    }
    this.#bar.hidden = !loading;
    this.#bar.blocking = switching;
  }
}
