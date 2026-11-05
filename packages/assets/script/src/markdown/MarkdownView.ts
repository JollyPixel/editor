// Import Third-party Dependencies
import DOMPurify from "dompurify";
import { marked } from "marked";

// CONSTANTS
const kStyles = `
  :host {
    display: block;
  }

  :host([hidden]) {
    display: none;
  }

  article {
    max-width: 80ch;
    line-height: 1.6;
  }

  article > :first-child {
    margin-top: 0;
  }

  h1,
  h2 {
    padding-bottom: var(--jolly-space-1);
    border-bottom: 1px solid var(--jolly-border);
  }

  a {
    color: var(--jolly-accent-text);
  }

  code,
  pre {
    border-radius: var(--jolly-radius-sm);
    background: var(--jolly-surface-sunken);
    font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
    font-size: 0.9em;
  }

  code {
    padding: 0.1em 0.3em;
  }

  pre {
    overflow: auto;
    padding: var(--jolly-space-3);
  }

  pre code {
    padding: 0;
    background: none;
  }

  blockquote {
    margin-inline: 0;
    padding-inline-start: var(--jolly-space-3);
    border-inline-start: 3px solid var(--jolly-border-strong);
    color: var(--jolly-text-muted);
  }

  table {
    border-collapse: collapse;
  }

  th,
  td {
    padding: var(--jolly-space-1) var(--jolly-space-2);
    border: 1px solid var(--jolly-border);
  }

  img {
    max-width: 100%;
  }
`;

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export class MarkdownView extends HTMLElement {
  #article: HTMLElement;
  #markdown = "";

  constructor() {
    super();
    const style = document.createElement("style");
    style.textContent = kStyles;
    this.#article = document.createElement("article");
    this.attachShadow({ mode: "open" }).append(style, this.#article);
  }

  get markdown(): string {
    return this.#markdown;
  }

  set markdown(
    value: string
  ) {
    this.#markdown = value;
    this.#article.innerHTML = DOMPurify.sanitize(
      marked.parse(value, { async: false })
    );
  }
}

customElements.define("jolly-markdown", MarkdownView);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-markdown": MarkdownView;
  }
}
