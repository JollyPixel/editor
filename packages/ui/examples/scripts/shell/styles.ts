// Import Third-party Dependencies
import { css } from "lit";

export const shellStyles = css`
  :host {
    display: block;
    height: 100%;
    background: var(--jolly-surface);
    color: var(--jolly-text);
    font-family: var(--jolly-font-family);
    font-size: var(--jolly-font-size);
  }

  .layout {
    display: flex;
    height: 100%;
  }

  .layout[data-chrome="off"] {
    display: block;
  }

  .layout > jolly-dock {
    flex: 0 0 auto;
  }

  .gallery-pane {
    width: 100%;
    height: 100%;
  }

  .gallery-pane::part(header) {
    flex-wrap: wrap;
  }

  .gallery-pane::part(title) {
    flex-basis: 100%;
  }

  .gallery-pane::part(actions) {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }

  .gallery-pane > [slot="actions"] {
    --jolly-text: var(--jolly-text-on-fill);
    --jolly-text-muted: color-mix(
      in oklab,
      var(--jolly-text-on-fill) 72%,
      transparent
    );

    flex: 1 1 96px;
    min-width: 96px;
    color: var(--jolly-text-on-fill);
  }

  nav {
    display: grid;
    gap: 1px;
  }

  a {
    display: block;
    padding: 0 var(--jolly-space-2);
    border-radius: var(--jolly-radius-sm);
    color: var(--jolly-text);
    line-height: var(--jolly-row-height);
    text-decoration: none;
    transition: background-color var(--jolly-duration-fast) var(--jolly-easing);
  }

  a:hover {
    background: var(--jolly-control-bg-hover);
  }

  a[aria-current="page"] {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  a:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
    outline-offset: 2px;
  }

  main {
    overflow: auto;
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--jolly-space-4);
  }

  .options {
    --jolly-label-max-width: none;

    display: grid;
    flex: 0 0 200px;
    align-content: start;
    gap: var(--jolly-space-2);
    padding: var(--jolly-space-3);
    border-inline-start: 1px solid var(--jolly-border);
    background: var(--jolly-surface-sunken);
  }

  .options[hidden] {
    display: none;
  }

  .options h3 {
    margin: 0;
    font-size: 0.9em;
    color: var(--jolly-text-muted);
  }
`;
