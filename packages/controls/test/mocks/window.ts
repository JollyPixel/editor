// Import Internal Dependencies
import { EventTargetAdapter } from "./eventTarget.ts";
import { NavigatorAdapter } from "./navigator.ts";

export class WindowAdapter extends EventTargetAdapter {
  navigator = new NavigatorAdapter();
  onbeforeunload: (() => void) | null = null;
}
