// Import Internal Dependencies
import { importRenderedElements } from "../../../oxlint/rules/importRenderedElements.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

// CONSTANTS
const kOptions = [
  {
    elements: ["button", "dialog", "icon", "tab", "tabs", "text"]
  }
];

function valid(
  code: string
) {
  return {
    code,
    options: kOptions
  };
}

function invalid(
  code: string,
  errors: number | { message: string; }[]
) {
  return {
    code,
    options: kOptions,
    errors
  };
}

ruleTester.run("import-rendered-elements", importRenderedElements, {
  valid: [
    valid("import \"@jolly-pixel/ui/elements/button\"; html`<jolly-button>Go</jolly-button>`;"),
    valid(
      "import { Dialog } from \"@jolly-pixel/ui/elements/dialog\"; document.createElement(\"jolly-dialog\");"
    ),
    valid("css`jolly-button { color: red; }`; host.querySelector(\"jolly-dialog\");"),
    valid("html`<jolly-console></jolly-console><studio-panel></studio-panel>`;")
  ],
  invalid: [
    invalid(
      "import \"@jolly-pixel/ui\"; html`<div><jolly-icon></jolly-icon></div>`;",
      [{ message: "Import \"@jolly-pixel/ui/elements/icon\" to register <jolly-icon>." }]
    ),
    invalid("html`<jolly-tabs><jolly-tab></jolly-tab></jolly-tabs>`;", 2),
    invalid("const field = document.createElement(\"jolly-text\");", 1)
  ]
});
