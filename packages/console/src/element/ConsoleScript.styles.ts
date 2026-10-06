// Import Third-party Dependencies
import { css } from "lit";

export const consoleScriptStyles = css`
  :host {
    --jolly-console-script-line: calc(var(--jolly-font-size, 11px) + 7px);
    --jolly-console-script-comment: var(--jolly-text-muted, #9aa0a6);
    --jolly-console-script-section: var(--jolly-accent-text, #93c5fd);
    --jolly-console-script-number: var(--jolly-warning, #fcd34d);
    --jolly-console-script-keyword: var(--jolly-accent-text, #93c5fd);
    --jolly-console-script-string: var(--jolly-success, #86efac);
    --jolly-console-script-error: var(--jolly-danger, #ff6b6b);

    display: block;
    font-size: calc(var(--jolly-font-size, 11px) + 1px);
  }

  .scroller {
    display: flex;
    max-height: calc(100vh - var(--jolly-console-top, 30vh) - 96px);
    overflow: auto;
    box-shadow: inset 0 1px 3px light-dark(rgb(0 0 0 / 6%), rgb(0 0 0 / 22%));
    line-height: var(--jolly-console-script-line);
    scrollbar-color: var(--jolly-groove, rgb(255 255 255 / 20%)) transparent;
    scrollbar-width: thin;
  }

  .gutter {
    position: sticky;
    left: 0;
    z-index: 1;
    flex: none;
    min-width: 3ch;
    padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
    background: var(--jolly-console-bg, #2b2f36);
    color: var(--jolly-text-muted, #9aa0a6);
    text-align: end;
    opacity: 0.7;
    user-select: none;
  }

  .gutter .invalid {
    color: var(--jolly-console-script-error);
    opacity: 1;
  }

  .code {
    display: grid;
    flex: 1 0 auto;
  }

  pre,
  textarea {
    grid-area: 1 / 1;
    box-sizing: border-box;
    margin: 0;
    padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
    border: 0;
    font: inherit;
    letter-spacing: inherit;
    line-height: inherit;
    white-space: pre;
    overflow-wrap: normal;
    tab-size: 2;
  }

  pre {
    color: var(--jolly-text, #e6e6e6);
    pointer-events: none;
  }

  textarea {
    width: 100%;
    height: 100%;
    min-width: 0;
    overflow: hidden;
    outline: none;
    background: transparent;
    color: transparent;
    caret-color: var(--jolly-text, #e6e6e6);
    resize: none;
    -webkit-text-fill-color: transparent;
  }

  textarea::selection {
    background: color-mix(in oklab, var(--jolly-accent-fill, #3b82f6) 40%, transparent);
  }

  .comment {
    color: var(--jolly-console-script-comment);
  }

  .section {
    color: var(--jolly-console-script-section);
    font-weight: 700;
  }

  .operator {
    color: var(--jolly-text-muted, #9aa0a6);
  }

  .value-number {
    color: var(--jolly-console-script-number);
  }

  .value-boolean,
  .value-enum {
    color: var(--jolly-console-script-keyword);
  }

  .value-string {
    color: var(--jolly-console-script-string);
  }

  .error {
    text-decoration: underline wavy var(--jolly-console-script-error);
    text-decoration-skip-ink: none;
    text-underline-offset: 3px;
  }

  .status {
    min-height: var(--jolly-console-row, 24px);
    padding: var(--jolly-space-1, 4px) var(--jolly-space-3, 12px);
    border-top: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
    box-sizing: border-box;
    color: var(--jolly-text-muted, #9aa0a6);
    font-size: var(--jolly-font-size, 11px);
  }

  .status.invalid {
    color: var(--jolly-console-script-error);
  }
`;
