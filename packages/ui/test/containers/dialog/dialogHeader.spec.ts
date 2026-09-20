// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isDialogIntent,
  resolveDialogHeader
} from "../../../src/containers/dialog/dialogHeader.ts";
import { registerIcon } from "../../../src/icon/registry.ts";

describe("resolveDialogHeader", () => {
  test("a bare dialog has no icon, tone or intent", () => {
    assert.deepEqual(
      resolveDialogHeader({ icon: "", tone: "", intent: "" }),
      { icon: "", intent: null, tone: null, alert: false }
    );
  });

  test("an explicit tone wins over the icon's registered tone", () => {
    registerIcon("test-dialog-teal", "<path />", { tone: "teal" });

    assert.equal(
      resolveDialogHeader({
        icon: "test-dialog-teal",
        tone: "",
        intent: ""
      }).tone,
      "teal"
    );
    assert.equal(
      resolveDialogHeader({
        icon: "test-dialog-teal",
        tone: "pink",
        intent: ""
      }).tone,
      "pink"
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
      assert.equal(
        resolveDialogHeader({ icon: "", tone: "", intent }).icon,
        icon
      );
    }
  });

  test("an explicit icon wins over the intent's default", () => {
    assert.equal(
      resolveDialogHeader({
        icon: "lock",
        tone: "",
        intent: "danger"
      }).icon,
      "lock"
    );
  });

  test("an intent drops the area tone", () => {
    registerIcon("test-dialog-lime", "<path />", { tone: "lime" });

    assert.equal(
      resolveDialogHeader({
        icon: "test-dialog-lime",
        tone: "violet",
        intent: "warning"
      }).tone,
      null
    );
  });

  test("only warning and danger raise an alert", () => {
    const alerts = ["info", "success", "warning", "danger"]
      .filter((intent) => resolveDialogHeader({
        icon: "",
        tone: "",
        intent
      }).alert);

    assert.deepEqual(alerts, ["warning", "danger"]);
  });

  test("an unknown intent is ignored", () => {
    assert.equal(isDialogIntent("fatal"), false);
    assert.deepEqual(
      resolveDialogHeader({ icon: "", tone: "sky", intent: "fatal" }),
      { icon: "", intent: null, tone: "sky", alert: false }
    );
  });
});
