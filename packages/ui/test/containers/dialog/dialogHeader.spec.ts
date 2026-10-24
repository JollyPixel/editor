// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isDialogIntent,
  resolveDialogHeader,
  type DialogHeader,
  type DialogHeaderSource
} from "../../../src/containers/dialog/dialogHeader.ts";
import { registerIcon } from "../../../src/icon/registry.ts";

function header(
  source: Partial<DialogHeaderSource>
): DialogHeader {
  return resolveDialogHeader({
    icon: "",
    tone: "",
    intent: "",
    paneTone: null,
    ...source
  });
}

describe("resolveDialogHeader", () => {
  test("a bare dialog has no icon, tone or intent", () => {
    assert.deepEqual(
      header({}),
      { icon: "", intent: null, tone: null, alert: false }
    );
  });

  test("an explicit tone wins over the icon's registered tone", () => {
    registerIcon("test-dialog-teal", "<path />", { tone: "teal" });

    assert.equal(header({ icon: "test-dialog-teal" }).tone, "teal");
    assert.equal(
      header({ icon: "test-dialog-teal", tone: "pink" }).tone,
      "pink"
    );
  });

  test("the pane's tone sits between an explicit tone and the icon's", () => {
    registerIcon("test-dialog-amber", "<path />", { tone: "amber" });

    assert.equal(
      header({ icon: "test-dialog-amber", paneTone: "sky" }).tone,
      "sky"
    );
    assert.equal(
      header({
        icon: "test-dialog-amber",
        tone: "coral",
        paneTone: "sky"
      }).tone,
      "coral"
    );
  });

  test("an intent supplies a default icon", () => {
    const icons = {
      info: "info",
      success: "check",
      warning: "warning",
      danger: "warning"
    };

    for (const [intent, icon] of Object.entries(icons)) {
      assert.equal(header({ intent }).icon, icon);
    }
  });

  test("an explicit icon wins over the intent's default", () => {
    assert.equal(header({ icon: "lock", intent: "danger" }).icon, "lock");
  });

  test("an intent drops the area tone", () => {
    registerIcon("test-dialog-lime", "<path />", { tone: "lime" });

    assert.equal(
      header({
        icon: "test-dialog-lime",
        tone: "violet",
        intent: "warning",
        paneTone: "sky"
      }).tone,
      null
    );
  });

  test("only warning and danger raise an alert", () => {
    const alerts = ["info", "success", "warning", "danger"]
      .filter((intent) => header({ intent }).alert);

    assert.deepEqual(alerts, ["warning", "danger"]);
  });

  test("an unknown intent is ignored", () => {
    assert.equal(isDialogIntent("fatal"), false);
    assert.deepEqual(
      header({ tone: "sky", intent: "fatal" }),
      { icon: "", intent: null, tone: "sky", alert: false }
    );
  });
});
