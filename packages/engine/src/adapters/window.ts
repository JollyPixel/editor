// Import Internal Dependencies
import type {
  EventTargetAdapter,
  EventTargetListener
} from "./eventTarget.js";
import {
  type NavigatorAdapter,
  BrowserNavigatorAdapter
} from "./navigator.js";

export interface WindowAdapter extends EventTargetAdapter {
  onbeforeunload?: ((this: Window, ev: BeforeUnloadEvent) => any) | null;

  navigator: NavigatorAdapter;
}

export class BrowserWindowAdapter implements WindowAdapter {
  navigator: NavigatorAdapter = new BrowserNavigatorAdapter();

  addEventListener(
    type: string,
    listener: EventTargetListener
  ) {
    window.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: EventTargetListener
  ) {
    window.removeEventListener(type, listener);
  }
}
