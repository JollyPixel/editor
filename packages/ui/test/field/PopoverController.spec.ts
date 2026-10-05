// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test } from "node:test";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  PopoverController,
  type PopoverControllerOptions
} from "../../src/field/PopoverController.ts";

function fixture(
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
    controller,
    cleanup() {
      controller.hostDisconnected();
      anchor.remove();
      popover.remove();
    }
  };
}

test("hover opening is opt-in, ignores touch and disabled triggers", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const scenario of ["disabled option", "touch", "disabled trigger"]) {
    const f = fixture({
      openOnHover: scenario === "disabled option" ? undefined : {}
    });
    t.after(() => f.cleanup());
    f.anchor.disabled = scenario === "disabled trigger";
    const open = t.mock.method(f.popover, "showPopover", () => undefined);
    f.controller.onPointerEnter(new PointerEvent("pointerenter", {
      pointerType: scenario === "touch" ? "touch" : "mouse"
    }));
    t.mock.timers.tick(1000);
    assert.equal(open.mock.callCount(), 0);
  }
});

for (const delay of [0, 200, 700]) {
  test(
    "hover opens after " + delay + "ms",
    (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const f = fixture({
        openOnHover: {
          delay: delay === 200 ? undefined : delay
        }
      });
      t.after(() => f.cleanup());
      const open = t.mock.method(f.popover, "showPopover", () => undefined);
      f.controller.onPointerEnter(new PointerEvent("pointerenter", {
        pointerType: "mouse"
      }));
      if (delay > 0) {
        t.mock.timers.tick(delay - 1);
        assert.equal(open.mock.callCount(), 0);
        t.mock.timers.tick(1);
      }
      assert.equal(open.mock.callCount(), 1);
    }
  );
}

for (const cancellation of ["leave", "disconnect", "remove", "hide", "show"]) {
  test(
    cancellation + " cancels a pending hover open",
    (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const f = fixture({ openOnHover: {} });
      t.after(() => f.cleanup());
      const open = t.mock.method(f.popover, "showPopover", () => undefined);
      t.mock.method(f.popover, "hidePopover", () => undefined);
      f.controller.onPointerEnter(new PointerEvent("pointerenter", {
        pointerType: "mouse"
      }));
      if (cancellation === "leave") {
        f.controller.onPointerLeave(new PointerEvent("pointerleave", {
          pointerType: "mouse"
        }));
      }
      if (cancellation === "disconnect") {
        f.controller.hostDisconnected();
      }
      if (cancellation === "remove") {
        f.anchor.remove();
      }
      if (cancellation === "hide") {
        f.controller.hide();
      }
      if (cancellation === "show") {
        f.controller.show();
      }
      t.mock.timers.tick(1000);
      assert.equal(open.mock.callCount(), cancellation === "show" ? 1 : 0);
    }
  );
}

for (const delay of [0, 200, 600]) {
  test("hover closes after " + delay + "ms", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = fixture({
      closeOnHoverLeave: {
        delay: delay === 200 ? undefined : delay
      }
    });
    t.after(() => f.cleanup());
    const matches = f.popover.matches.bind(f.popover);
    t.mock.method(
      f.popover,
      "matches",
      (selector: string) => selector === ":popover-open" || matches(selector)
    );
    const close = t.mock.method(f.popover, "hidePopover", () => undefined);
    f.controller.onPointerLeave(new PointerEvent("pointerleave", {
      pointerType: "mouse"
    }));
    if (delay > 0) {
      t.mock.timers.tick(delay - 1);
      assert.equal(close.mock.callCount(), 0);
      t.mock.timers.tick(1);
    }
    assert.equal(close.mock.callCount(), 1);
  });
}

test("re-entering the popover cancels a pending close", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture({ closeOnHoverLeave: {} });
  t.after(() => f.cleanup());
  const matches = f.popover.matches.bind(f.popover);
  t.mock.method(
    f.popover,
    "matches",
    (selector: string) => selector === ":popover-open" || matches(selector)
  );
  const close = t.mock.method(f.popover, "hidePopover", () => undefined);
  f.controller.onPointerLeave(new PointerEvent("pointerleave", {
    pointerType: "mouse"
  }));
  t.mock.timers.tick(199);
  f.controller.onPointerEnter(new PointerEvent("pointerenter", {
    pointerType: "mouse"
  }));
  t.mock.timers.tick(1000);
  assert.equal(close.mock.callCount(), 0);
});
