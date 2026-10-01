// Import Third-party Dependencies
import {
  CommandConsole,
  isToggleShortcut
} from "@jolly-pixel/console";

// Import Internal Dependencies
import { PageAppearance } from "../appearance/PageAppearance.ts";
import type { ShellChannel } from "../launch/ShellChannel.ts";
import type { PageConsole } from "./mountConsole.ts";

export function forwardConsole(
  shell: ShellChannel
): PageConsole {
  const commands = new CommandConsole();
  const page = new PageAppearance();
  if (shell.appearance !== null) {
    page.apply(shell.appearance);
  }

  const listening = new AbortController();
  const { signal } = listening;
  window.addEventListener("keydown", (event) => {
    if (isToggleShortcut(event)) {
      event.preventDefault();
      shell.toggleConsole();
    }
  }, { capture: true, signal });
  shell.onAppearance((appearance) => page.apply(appearance), signal);

  return {
    commands,
    dispose() {
      listening.abort();
      commands.unregister();
    }
  };
}
