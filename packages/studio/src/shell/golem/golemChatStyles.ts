// Import Third-party Dependencies
import { css } from "lit";

export const golemChatStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 320px;
    min-height: 0;
    margin: 0 var(--studio-gutter) var(--studio-gutter) 0;
    overflow: hidden;
    border-radius: var(--studio-radius);
    background: var(--studio-board);
    box-shadow: inset 0 -1px 0 var(--studio-shade);
  }

  :host([hidden]) {
    display: none;
  }

  header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    min-height: var(--studio-card-head-height, 36px);
    padding-inline: var(--jolly-space-3, 12px) var(--jolly-space-2, 8px);
    box-shadow: var(--studio-bevel);

    --jolly-icon-button-size: 24px;
  }

  header jolly-icon {
    --jolly-icon-size: 16px;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: inherit;
    font-weight: 600;
  }

  .notice {
    padding: var(--jolly-space-2, 8px);
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--jolly-accent);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .agents {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: var(--jolly-space-2, 8px);
    list-style: none;
    box-shadow: inset 0 -1px 0 var(--studio-shade);
  }

  .agent {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    min-height: 28px;
    padding-inline: var(--jolly-space-1, 4px);

    --jolly-avatar-size: 20px;
    --jolly-avatar-presence-ring: var(--studio-board);
    --jolly-icon-button-size: 22px;
  }

  .who {
    display: grid;
    min-width: 0;
  }

  .name,
  .status {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .name {
    font-weight: 600;
  }

  .owner,
  .status,
  .muted {
    color: var(--jolly-text-muted);
    font-weight: normal;
  }

  .status[data-running] {
    color: var(--jolly-accent);
  }

  .feed {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--jolly-space-3, 12px);
    min-height: 0;
    padding: var(--jolly-space-2, 8px);
    overflow-y: auto;
  }

  .lines {
    display: grid;
    gap: var(--jolly-space-3, 12px);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .lines:empty {
    display: none;
  }

  .group {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--jolly-space-2, 8px);

    --jolly-avatar-size: 20px;
  }

  .group jolly-avatar {
    margin-block-start: 5px;
  }

  .body {
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 4px var(--jolly-space-2, 8px) 6px;
    border-radius: var(--jolly-radius-md, 6px);
  }

  .group[data-agent] .body,
  .card {
    background: color-mix(in oklab, var(--author) 9%, transparent);
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }

  .author {
    overflow: hidden;
    color: var(--author);
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .via {
    padding: 0 4px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg);
    color: var(--jolly-text-muted);
  }

  time {
    margin-inline-start: auto;
    color: var(--jolly-text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .text {
    margin: 0;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .asset {
    justify-self: start;
    max-width: 100%;
    margin-block: 2px;
    padding: 1px 6px;
    overflow: hidden;
    border: none;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-control-bg);
    color: inherit;
    font: inherit;
    white-space: nowrap;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .asset:hover {
    background: var(--jolly-control-bg-hover);
  }

  .asset:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
  }

  .card {
    display: grid;
    gap: var(--jolly-space-2, 8px);
    padding: var(--jolly-space-2, 8px);
    border-radius: var(--jolly-radius-md, 6px);
    box-shadow: inset 3px 0 0 var(--author);
  }

  .card p {
    margin: 0;
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jolly-space-1, 4px);
  }

  .working {
    display: flex;
    align-items: center;
    gap: var(--jolly-space-2, 8px);
    margin: 0;
    color: var(--jolly-text-muted);
  }

  .dots {
    display: inline-flex;
    gap: 3px;
    padding-inline: 6px;
  }

  .dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--author);
    animation: blink 1.2s infinite ease-in-out;
  }

  .dots span:nth-child(2) {
    animation-delay: 0.15s;
  }

  .dots span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes blink {
    0%,
    80%,
    100% {
      opacity: 0.25;
    }

    40% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dots span {
      animation: none;
      opacity: 0.6;
    }
  }

  .empty {
    max-width: 26ch;
    margin: auto;
    color: var(--jolly-text-muted);
    line-height: 1.45;
    text-align: center;
  }

  form {
    display: grid;
    gap: var(--jolly-space-1, 4px);
    padding: var(--jolly-space-2, 8px);
    box-shadow: inset 0 1px 0 var(--studio-shade);
  }

  .box {
    display: flex;
    align-items: flex-end;
    gap: var(--jolly-space-1, 4px);
    padding: 4px 4px 4px var(--jolly-space-2, 8px);
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-control-bg);
    transition: background-color var(--jolly-duration-fast, 100ms)
        var(--jolly-easing, ease),
      box-shadow var(--jolly-duration-fast, 100ms) var(--jolly-easing, ease);

    --jolly-icon-button-size: 24px;
  }

  .box:hover {
    background: var(--jolly-control-bg-hover);
  }

  .box:focus-within {
    background: var(--jolly-control-bg-hover);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--jolly-accent) 60%, transparent);
  }

  textarea {
    flex: 1;
    min-width: 0;
    min-height: 2lh;
    max-height: 8lh;
    margin: 0;
    padding: 3px 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: 1.45;
    resize: none;
    outline: none;
    field-sizing: content;
  }

  textarea::placeholder {
    color: var(--jolly-text-muted);
    opacity: 1;
  }

  .hint {
    display: flex;
    justify-content: space-between;
    gap: var(--jolly-space-2, 8px);
    padding-inline: 2px;
    color: var(--jolly-text-muted);
  }

  .count[data-over] {
    color: var(--jolly-danger);
  }

  .read-only {
    margin: 0;
    padding: var(--jolly-space-2, 8px);
    color: var(--jolly-text-muted);
    text-align: center;
  }

  .error {
    margin: 0;
    color: var(--jolly-danger);
  }
`;
