// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  html,
  render
} from "lit";

// Import Internal Dependencies
import { renderRailButton } from "../../src/shared/railButton.ts";

function renderButton(
  ...args: Parameters<typeof renderRailButton>
): HTMLButtonElement {
  const container = document.createElement("div");
  render(renderRailButton(...args), container);

  return container.querySelector("button")!;
}

describe("renderRailButton", () => {
  test("uses the label as tooltip and omits aria-pressed by default", () => {
    const button = renderButton({
      part: "undo-button",
      label: "Undo",
      icon: "undo",
      onClick: () => undefined
    });

    assert.equal(button.className.trim(), "rail-btn");
    assert.equal(button.getAttribute("part"), "undo-button");
    assert.equal(button.getAttribute("aria-label"), "Undo");
    assert.equal(button.hasAttribute("aria-pressed"), false);
    assert.equal(button.disabled, false);
    assert.equal(button.querySelector(".tooltip")?.textContent, "Undo");
  });

  test("renders a pressed toggle with its own tooltip", () => {
    const button = renderButton({
      part: "uv-show-all-button",
      label: "Show all",
      tooltip: "Show all regions",
      icon: "eye",
      pressed: true,
      onClick: () => undefined
    });

    assert.ok(button.classList.contains("active"));
    assert.equal(button.getAttribute("aria-pressed"), "true");
    assert.equal(button.querySelector(".tooltip")?.textContent, "Show all regions");
  });

  test("accepts a template icon and forwards clicks unless disabled", () => {
    let clicks = 0;
    const enabled = renderButton({
      part: "import-button",
      label: "Import texture",
      icon: html`<span class="custom-icon"></span>`,
      onClick: () => clicks++
    });
    const disabled = renderButton({
      part: "redo-button",
      label: "Redo",
      icon: "redo",
      disabled: true,
      onClick: () => clicks++
    });

    enabled.click();
    disabled.click();

    assert.ok(enabled.querySelector(".custom-icon"));
    assert.equal(disabled.disabled, true);
    assert.equal(clicks, 1);
  });
});
