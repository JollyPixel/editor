// Import Third-party Dependencies
import DOMPurify from "dompurify";
import {
  marked,
  type TokensList
} from "marked";

// Import Internal Dependencies
import { changedSpan } from "../text/changedSpan.ts";
import { leavesElementsOpen } from "./rawHtml.ts";

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

interface MarkdownBlock {
  raw: string;
  nodes: ChildNode[];
}

export class MarkdownView extends HTMLElement {
  #article: HTMLElement;
  #markdown = "";
  #blocks: MarkdownBlock[] | null = null;
  #links = "{}";

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
    const tokens = marked.lexer(value);
    if (tokens.some(leavesElementsOpen)) {
      this.#blocks = null;
      this.#article.replaceChildren(sanitize(marked.parser(tokens)));

      return;
    }

    const links = JSON.stringify(tokens.links);
    if (this.#blocks === null || links !== this.#links) {
      this.#blocks = [];
      this.#links = links;
      this.#article.replaceChildren();
    }
    this.#patch(this.#blocks, tokens);
  }

  #patch(
    previous: MarkdownBlock[],
    tokens: TokensList
  ): void {
    const { start, beforeEnd: previousEnd, afterEnd: end } = changedSpan(
      previous,
      tokens,
      (block, token) => block.raw === token.raw
    );
    for (const block of previous.slice(start, previousEnd)) {
      for (const node of block.nodes) {
        node.remove();
      }
    }
    const following = previous
      .slice(previousEnd)
      .find((block) => block.nodes.length > 0)?.nodes[0] ?? null;
    const fragment = sanitize(tokens.slice(start, end).map((token) => {
      const html = marked.parser(Object.assign([token], {
        links: tokens.links
      }));

      return `<div>${html}</div>`;
    }).join(""));
    const changed = Array.from(fragment.children).map((wrapper, index) => {
      const nodes = Array.from(wrapper.childNodes);
      wrapper.replaceWith(...nodes);

      return {
        raw: tokens[start + index].raw,
        nodes
      };
    });
    this.#article.insertBefore(fragment, following);

    this.#blocks = [
      ...previous.slice(0, start),
      ...changed,
      ...previous.slice(previousEnd)
    ];
  }
}

function sanitize(
  html: string
): DocumentFragment {
  return DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true
  });
}

customElements.define("jolly-markdown", MarkdownView);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-markdown": MarkdownView;
  }
}
