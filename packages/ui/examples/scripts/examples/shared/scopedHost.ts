// Import Internal Dependencies
import { themeStyles } from "../../../../src/index.ts";

// CONSTANTS
const kScopedHostStyles = `
  :host {
    display: grid;
    gap: var(--jolly-space-1);
    padding: var(--jolly-space-2);
    border: 1px solid var(--jolly-border);
    border-radius: var(--jolly-radius-md);
    background: var(--jolly-surface);
    color: var(--jolly-text);
    font-family: var(--jolly-font-family);
    font-size: var(--jolly-font-size);
    --jolly-label-width: 8ch;
  }

  .scenario-name {
    color: var(--jolly-text-muted);
    font-size: 0.8em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`;

/**
 * A plain shadow host for token demonstrations. It is not a custom element,
 * because Node imports the manifest where HTMLElement is unavailable.
 */
export function createScopedHost(
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
  sheet.replaceSync(`${themeStyles.cssText}\n${kScopedHostStyles}`);
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
