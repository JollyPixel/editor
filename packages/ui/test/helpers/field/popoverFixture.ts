// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  PopoverController,
  type PopoverControllerOptions
} from "../../../src/field/PopoverController.ts";

export type PopoverFixture = ReturnType<typeof popoverFixture>;

export function popoverFixture(
  options: Partial<PopoverControllerOptions> = {}
) {
  const anchor = document.createElement("button");
  const popover = document.createElement("div");
  popover.setAttribute("popover", "auto");
  Object.defineProperties(popover, {
    showPopover: {
      value: () => undefined,
      configurable: true
    },
    hidePopover: {
      value: () => undefined,
      configurable: true
    }
  });
  document.body.append(anchor, popover);
  const host: ReactiveControllerHost = {
    addController: () => undefined,
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true)
  };
  const controller = new PopoverController(host, {
    anchor: () => anchor,
    popover: () => popover,
    ...options
  });

  return {
    anchor,
    popover,
    host,
    controller,
    cleanup() {
      controller.hostDisconnected();
      anchor.remove();
      popover.remove();
    }
  };
}
