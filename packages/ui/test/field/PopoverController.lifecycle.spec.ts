// Import Node.js Dependencies
import assert from "node:assert/strict";
import { test } from "node:test";

// Import Internal Dependencies
import { popoverFixture } from "../helpers/field/popoverFixture.ts";

function toggleEvent(
  type: "beforetoggle" | "toggle",
  newState: "open" | "closed"
): ToggleEvent {
  return Object.assign(new Event(type), { newState }) as ToggleEvent;
}

test("a light-dismissed popover closes before the next render", (t) => {
  const onClose = t.mock.fn();
  const f = popoverFixture({
    claimsInput: false,
    onClose
  });
  t.after(() => f.cleanup());
  let open = true;
  const matches = f.popover.matches.bind(f.popover);
  t.mock.method(
    f.popover,
    "matches",
    (selector: string) => (selector === ":popover-open" ?
      open :
      matches(selector))
  );
  f.controller.onBeforeToggle(toggleEvent("beforetoggle", "open"));
  f.controller.onToggle(toggleEvent("toggle", "open"));
  const requestUpdate = t.mock.method(f.host, "requestUpdate");

  open = false;
  f.controller.hostUpdate?.();
  f.controller.hostUpdated();

  assert.equal(f.controller.open, false);
  assert.equal(onClose.mock.callCount(), 1);
  assert.equal(requestUpdate.mock.callCount(), 0);
});
