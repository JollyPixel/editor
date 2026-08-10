// Import Internal Dependencies
import { themeStyles } from "../../../../src/index.ts";
import { scenarioStyles } from "./styles.ts";

/**
 * A scope host built from a plain `div`, standing in for `jolly-pane` until P2 provides one.
 *
 * Not a custom element, and not defined at module scope: `manifest.ts` is imported by the end to
 * end suite inside Node, where `HTMLElement` does not exist, so a class declaration extending it
 * would throw at import time.
 *
 * A `div` accepts `attachShadow`, and `:host` then matches the div itself, which is all the token
 * declarations need.
 */
export function createScopeHost(
  attributes: Record<string, string>
): { host: HTMLElement; content: ShadowRoot; } {
  const host = document.createElement("div");
  for (const [name, value] of Object.entries(attributes)) {
    host.setAttribute(name, value);
    host.dataset[name] = value;
  }

  const content = host.attachShadow({
    mode: "open"
  });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${themeStyles.cssText}\n${scenarioStyles}`);
  content.adoptedStyleSheets = [sheet];

  return {
    host,
    content
  };
}

export function caption(
  text: string
): HTMLElement {
  const element = document.createElement("code");
  element.className = "scenario-name";
  element.textContent = text;

  return element;
}
