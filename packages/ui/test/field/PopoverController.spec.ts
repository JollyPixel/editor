// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

// Import Internal Dependencies
import {
  popoverFixture,
  type PopoverFixture
} from "../helpers/field/popoverFixture.ts";

test("hover opening is opt-in, ignores touch and disabled triggers", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const scenario of ["disabled option", "touch", "disabled trigger"]) {
    const f = popoverFixture({
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
      const f = popoverFixture({
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
      const f = popoverFixture({ openOnHover: {} });
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
    const f = popoverFixture({
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
  const f = popoverFixture({ closeOnHoverLeave: {} });
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

function hoverOpen(
  t: TestContext,
  f: PopoverFixture
) {
  let open = false;
  const matches = f.popover.matches.bind(f.popover);
  t.mock.method(
    f.popover,
    "matches",
    (selector: string) => (selector === ":popover-open" ?
      open :
      matches(selector))
  );
  t.mock.method(f.popover, "showPopover", () => {
    open = true;
  });
  const close = t.mock.method(f.popover, "hidePopover", () => {
    open = false;
  });
  f.controller.onPointerEnter(new PointerEvent("pointerenter", {
    pointerType: "mouse"
  }));
  t.mock.timers.tick(200);

  return close;
}

function clickTrigger(
  f: PopoverFixture
): boolean {
  return f.anchor.dispatchEvent(new PointerEvent("click", {
    bubbles: true,
    cancelable: true,
    composed: true
  }));
}

test("a click on the trigger keeps a hover-opened popover open", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = popoverFixture({
    openOnHover: {},
    closeOnHoverLeave: {}
  });
  t.after(() => f.cleanup());
  const close = hoverOpen(t, f);

  assert.equal(clickTrigger(f), false);
  f.controller.onPointerLeave(new PointerEvent("pointerleave", {
    pointerType: "mouse"
  }));
  t.mock.timers.tick(1000);
  assert.equal(close.mock.callCount(), 0);
  assert.equal(clickTrigger(f), true);
});

test("clicks pass through when hover did not open the popover", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const scenario of ["explicit show", "disconnected host"]) {
    const f = popoverFixture({ openOnHover: {} });
    t.after(() => f.cleanup());
    if (scenario === "explicit show") {
      t.mock.method(
        f.popover,
        "matches",
        (selector: string) => selector === ":popover-open"
      );
      f.controller.show();
    }
    else {
      hoverOpen(t, f);
      f.controller.hostDisconnected();
    }

    assert.equal(clickTrigger(f), true, scenario);
  }
});

test("clicks outside the trigger leave a hover-opened popover alone", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = popoverFixture({ openOnHover: {} });
  t.after(() => f.cleanup());
  hoverOpen(t, f);

  assert.equal(f.popover.dispatchEvent(new PointerEvent("click", {
    bubbles: true,
    cancelable: true
  })), true);
  assert.equal(clickTrigger(f), false);
});

test("placeAgainst replaces the anchor box, null falls back", (t) => {
  const toolbar = { top: 10, bottom: 40, left: 20, right: 120 };
  const trigger = { top: 100, bottom: 126, left: 50, right: 80 };
  for (const scenario of ["rect", "null"]) {
    const f = popoverFixture({
      anchor: () => trigger,
      placeAgainst: () => (scenario === "rect" ? toolbar : null)
    });
    t.after(() => f.cleanup());
    t.mock.method(
      f.popover,
      "matches",
      (selector: string) => selector === ":popover-open"
    );
    f.controller.show();

    assert.deepEqual(
      [f.popover.style.left, f.popover.style.top],
      scenario === "rect" ? ["20px", "44px"] : ["50px", "130px"],
      scenario
    );
  }
});
